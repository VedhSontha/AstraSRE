"""
inventory service — backed by REAL Redis cache
Cache: stock levels per product (TTL 30s)
Chaos: db_fail → Redis UNAVAILABLE → cache miss → 503
       cache_recovery action → FLUSHDB + repopulate
"""
from flask import Flask, jsonify, request
from prometheus_client import Gauge, Counter, start_http_server
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
import threading, time, random, json, os
import requests as http

try:
    import redis as redis_lib
    HAS_REDIS = True
except ImportError:
    HAS_REDIS = False

app = Flask(__name__)

SERVICE_NAME = "inventory"
LOKI_URL     = os.getenv("LOKI_URL",      "http://loki:3100")
OTLP_EP      = os.getenv("OTLP_ENDPOINT", "http://jaeger:4318/v1/traces")
PAYMENT_URL  = os.getenv("PAYMENT_URL",   "http://payment:5002")
REDIS_URL    = os.getenv("REDIS_URL",     "redis://redis:6379/0")

SERVICE_STATE = {"latency_mode": False, "db_fail": False, "crashed": False}

# ── Prometheus ────────────────────────────────────────────────────────────
CPU_G       = Gauge('cpu_usage_percent',  'CPU %',        ['service'])
LAT_G       = Gauge('latency_ms',         'Latency ms',   ['service'])
ERR_G       = Gauge('error_rate_percent', 'Error %',      ['service'])
CACHE_HIT_G = Gauge('cache_hit_rate',     'Cache hit %',  ['service'])
REQ_C       = Counter('request_total',    'Requests',     ['service'])
ERR_C       = Counter('error_total',      'Errors',       ['service'])
CACHE_HIT_C = Counter('cache_hit_total',  'Cache hits',   ['service'])
CACHE_MIS_C = Counter('cache_miss_total', 'Cache misses', ['service'])

# ── Tracing ───────────────────────────────────────────────────────────────
try:
    _prov = TracerProvider()
    _prov.add_span_processor(BatchSpanProcessor(OTLPSpanExporter(endpoint=OTLP_EP)))
    trace.set_tracer_provider(_prov)
except Exception:
    pass
tracer = trace.get_tracer(SERVICE_NAME)

# ── Logging ───────────────────────────────────────────────────────────────
def log(level, message, **kw):
    entry = json.dumps({"ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                        "service": SERVICE_NAME, "level": level,
                        "message": message, **kw})
    # Telemetry console logger
    print(entry, flush=True)
    try:
        http.post(f"{LOKI_URL}/loki/api/v1/push",
                  json={"streams":[{"stream":{"service":SERVICE_NAME,"level":level},
                                    "values":[[str(int(time.time()*1e9)), entry]]}]},
                  timeout=0.5)
    except Exception:
        pass

# ── Redis helpers ─────────────────────────────────────────────────────────
_redis_client = None
_cache_hits   = 0
_cache_total  = 0

def get_redis():
    global _redis_client
    if not HAS_REDIS:
        raise RuntimeError("redis-py not installed")
    if _redis_client is None:
        _redis_client = redis_lib.from_url(
            REDIS_URL,
            socket_connect_timeout=2,
            socket_timeout=2,
            decode_responses=True
        )
    return _redis_client

def init_redis(retries=10):
    """Seed initial stock levels into Redis."""
    for attempt in range(retries):
        try:
            r = get_redis()
            r.ping()
            # Seed stock for 5 products if not already set
            for product_id in range(1, 6):
                key = f"stock:product:{product_id}"
                if not r.exists(key):
                    r.setex(key, 60, random.randint(100, 500))
            log("INFO", "Redis connected and stock seeded")
            return
        except Exception as e:
            log("WARN", f"Redis init attempt {attempt+1}/{retries} failed",
                error=str(e)[:80])
            time.sleep(3)
    log("ERROR", "Could not connect to Redis after retries — running without cache")

def cache_recovery():
    """Flush Redis cache and re-seed (used by action engine)."""
    try:
        r = get_redis()
        r.flushdb()
        for product_id in range(1, 6):
            r.setex(f"stock:product:{product_id}", 60, random.randint(100, 500))
        log("INFO", "Redis cache flushed and repopulated — cache recovery complete")
        return True
    except Exception as e:
        log("ERROR", "Cache recovery failed", error=str(e)[:100])
        return False

# ── Metric simulation ─────────────────────────────────────────────────────
def _sim():
    global _cache_hits, _cache_total
    while True:
        s = SERVICE_STATE
        if s["crashed"]:
            cpu, lat, err = random.uniform(0,5), 9999.0, 100.0
            CACHE_HIT_G.labels(service=SERVICE_NAME).set(0)
        elif s["db_fail"]:
            cpu = random.uniform(75, 95)
            lat = random.uniform(600, 900)
            err = random.uniform(25, 40)
            CACHE_HIT_G.labels(service=SERVICE_NAME).set(0)
        elif s["latency_mode"]:
            cpu = random.uniform(60, 80)
            lat = random.uniform(400, 700)
            err = random.uniform(5, 15)
            CACHE_HIT_G.labels(service=SERVICE_NAME).set(random.uniform(20, 50))
        else:
            cpu = random.uniform(10, 30)
            lat = 120 + (cpu - 10) * 2 + random.uniform(-15, 15)
            err = max(0, random.uniform(-0.5, 1.0))
            hit_rate = (_cache_hits / _cache_total * 100) if _cache_total > 0 else 85.0
            CACHE_HIT_G.labels(service=SERVICE_NAME).set(hit_rate)
        CPU_G.labels(service=SERVICE_NAME).set(cpu)
        LAT_G.labels(service=SERVICE_NAME).set(lat)
        ERR_G.labels(service=SERVICE_NAME).set(err)
        time.sleep(2)

# ── Routes ────────────────────────────────────────────────────────────────
@app.route("/health")
def health():
    if SERVICE_STATE["crashed"]:
        return jsonify({"status": "down", "service": SERVICE_NAME}), 500
    redis_ok = False
    try:
        get_redis().ping(); redis_ok = True
    except Exception:
        pass
    return jsonify({"status": "ok", "service": SERVICE_NAME,
                    "cache": "ok" if redis_ok else "degraded"})

@app.route("/state", methods=["GET"])
def get_state():
    return jsonify(SERVICE_STATE)

@app.route("/state", methods=["POST"])
def set_state():
    data = request.get_json() or {}
    for k in ["latency_mode", "db_fail", "crashed"]:
        if k in data:
            SERVICE_STATE[k] = bool(data[k])
    log("INFO", "State changed", **SERVICE_STATE)
    return jsonify({"ok": True, "state": SERVICE_STATE})

@app.route("/cache/recover", methods=["POST"])
def recover_cache():
    """Called by action engine for cache recovery."""
    ok = cache_recovery()
    return jsonify({"ok": ok, "action": "cache_recovery"})

@app.route("/cache/stats", methods=["GET"])
def cache_stats():
    try:
        r = get_redis()
        info = r.info("stats")
        keys = r.dbsize()
        return jsonify({
            "keys":        keys,
            "hits":        info.get("keyspace_hits", 0),
            "misses":      info.get("keyspace_misses", 0),
            "hit_rate_pct": round(
                info.get("keyspace_hits", 0) /
                max(1, info.get("keyspace_hits", 0) + info.get("keyspace_misses", 0)) * 100, 1)
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/check", methods=["GET"])
def check():
    global _cache_hits, _cache_total
    REQ_C.labels(service=SERVICE_NAME).inc()
    with tracer.start_as_current_span("inventory-check") as span:

        if SERVICE_STATE["crashed"]:
            ERR_C.labels(service=SERVICE_NAME).inc()
            return jsonify({"status": "error", "reason": "service_crashed"}), 500

        if SERVICE_STATE["db_fail"]:
            ERR_C.labels(service=SERVICE_NAME).inc()
            CACHE_MIS_C.labels(service=SERVICE_NAME).inc()
            span.set_attribute("error.type", "redis_unavailable")
            log("ERROR",
                "Redis connection refused — inventory cache unavailable",
                redis_host="redis:6379", error="ECONNREFUSED")
            return jsonify({
                "status": "error",
                "reason": "redis_unavailable",
                "detail": "ERR: Connection to redis:6379 refused — cache layer down"
            }), 500

        if SERVICE_STATE["latency_mode"]:
            delay = random.uniform(0.4, 0.8)
            log("WARN", "Redis slow response — cache degraded", latency_ms=int(delay*1000))
            time.sleep(delay)

        # Real Redis cache lookup
        product_id = random.randint(1, 5)
        cache_key  = f"stock:product:{product_id}"
        stock      = None
        from_cache = False

        try:
            r = get_redis()
            cached = r.get(cache_key)
            _cache_total += 1

            if cached is not None:
                stock      = int(cached)
                from_cache = True
                _cache_hits += 1
                CACHE_HIT_C.labels(service=SERVICE_NAME).inc()
                span.set_attribute("cache.hit", True)
                log("INFO", "Cache HIT", product_id=product_id, stock=stock)
            else:
                # Cache miss — compute stock and repopulate
                stock = random.randint(50, 200)
                r.setex(cache_key, 30, stock)
                CACHE_MIS_C.labels(service=SERVICE_NAME).inc()
                span.set_attribute("cache.hit", False)
                log("INFO", "Cache MISS — stock recomputed and cached",
                    product_id=product_id, stock=stock, ttl=30)

        except Exception as e:
            log("WARN", "Redis unavailable — falling back to in-memory", error=str(e)[:80])
            stock = random.randint(50, 200)

        # Call payment downstream
        try:
            pay_res  = http.get(f"{PAYMENT_URL}/pay", timeout=4)
            pay_data = pay_res.json()

            if pay_res.status_code != 200:
                ERR_C.labels(service=SERVICE_NAME).inc()
                span.set_attribute("error", True)
                log("ERROR", "Payment upstream failure", detail=pay_data)
                return jsonify({"status": "error", "reason": "payment_failure",
                                "detail": pay_data}), 500

            log("INFO", "Inventory check OK",
                stock=stock, product_id=product_id, from_cache=from_cache)
            return jsonify({
                "status":     "ok",
                "stock":      stock,
                "product_id": product_id,
                "from_cache": from_cache,
                "payment":    pay_data,
                "backend":    "redis"
            })

        except Exception as e:
            ERR_C.labels(service=SERVICE_NAME).inc()
            log("ERROR", "Cannot reach payment", error=str(e))
            return jsonify({"status": "error", "reason": str(e)}), 500

if __name__ == "__main__":
    start_http_server(8002)
    threading.Thread(target=_sim,        daemon=True).start()
    threading.Thread(target=init_redis,  daemon=True).start()
    log("INFO", "Inventory service started", app_port=5003, metrics_port=8002,
        cache="redis")
    app.run(host="0.0.0.0", port=5003)
