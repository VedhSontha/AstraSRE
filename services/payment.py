"""
payment service — backed by REAL PostgreSQL
Tables: payments, orders
Chaos: db_fail → genuine PostgreSQL error path
"""
from flask import Flask, jsonify, request
from prometheus_client import Gauge, Counter, start_http_server
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
import threading
import time
import random
import json
import os
import requests as http

try:
    import psycopg2
    import psycopg2.extras
    HAS_PG = True
except ImportError:
    HAS_PG = False

app = Flask(__name__)

SERVICE_NAME = "payment"
LOKI_URL     = os.getenv("LOKI_URL",      "http://loki:3100")
OTLP_EP      = os.getenv("OTLP_ENDPOINT", "http://jaeger:4318/v1/traces")
DATABASE_URL  = os.getenv("DATABASE_URL",
    "postgresql://astrasre:astrasre123@postgres:5432/astrasre")

SERVICE_STATE = {"latency_mode": False, "db_fail": False, "crashed": False}

# ── Prometheus ────────────────────────────────────────────────────────────
CPU_G = Gauge('cpu_usage_percent',  'CPU %',          ['service'])
LAT_G = Gauge('latency_ms',         'Latency ms',     ['service'])
ERR_G = Gauge('error_rate_percent', 'Error %',        ['service'])
DB_Q  = Gauge('db_query_duration_ms','DB query ms',   ['service'])
REQ_C = Counter('request_total',    'Requests',       ['service'])
ERR_C = Counter('error_total',      'Errors',         ['service'])
DB_ERR = Counter('db_error_total',  'DB errors',      ['service'])

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
    print(entry, flush=True)
    try:
        http.post(f"{LOKI_URL}/loki/api/v1/push",
                  json={"streams":[{"stream":{"service":SERVICE_NAME,"level":level},
                                    "values":[[str(int(time.time()*1e9)), entry]]}]},
                  timeout=0.5)
    except Exception:
        pass

# ── PostgreSQL helpers ────────────────────────────────────────────────────
def get_db(timeout=3):
    if not HAS_PG:
        raise RuntimeError("psycopg2 not installed")
    return psycopg2.connect(DATABASE_URL, connect_timeout=timeout)

def init_db(retries=10):
    """Create payment table if missing. Retries on startup until PG is ready."""
    for attempt in range(retries):
        try:
            conn = get_db()
            cur  = conn.cursor()
            cur.execute("""
                CREATE TABLE IF NOT EXISTS payments (
                    id         SERIAL PRIMARY KEY,
                    order_id   INTEGER,
                    amount     INTEGER NOT NULL,
                    status     VARCHAR(20) NOT NULL DEFAULT 'success',
                    latency_ms INTEGER,
                    created_at TIMESTAMP DEFAULT NOW()
                )
            """)
            conn.commit(); cur.close(); conn.close()
            log("INFO", "PostgreSQL connected and schema ready")
            return
        except Exception as e:
            log("WARN", f"DB init attempt {attempt+1}/{retries} failed", error=str(e)[:80])
            time.sleep(3)
    log("ERROR", "Could not connect to PostgreSQL after retries — running without DB")

# ── Metric simulation ─────────────────────────────────────────────────────
def _sim():
    while True:
        s = SERVICE_STATE
        if s["crashed"]:
            cpu, lat, err = random.uniform(0,5), 9999.0, 100.0
        elif s["db_fail"]:
            cpu = random.uniform(75, 95)
            lat = random.uniform(600, 900)
            err = random.uniform(25, 40)
            DB_Q.labels(service=SERVICE_NAME).set(random.uniform(800, 2000))
        elif s["latency_mode"]:
            cpu = random.uniform(60, 80)
            lat = random.uniform(400, 700)
            err = random.uniform(5, 15)
            DB_Q.labels(service=SERVICE_NAME).set(random.uniform(300, 600))
        else:
            cpu = random.uniform(10, 30)
            lat = 120 + (cpu - 10) * 2 + random.uniform(-15, 15)
            err = max(0, random.uniform(-0.5, 1.0))
            DB_Q.labels(service=SERVICE_NAME).set(random.uniform(5, 25))
        CPU_G.labels(service=SERVICE_NAME).set(cpu)
        LAT_G.labels(service=SERVICE_NAME).set(lat)
        ERR_G.labels(service=SERVICE_NAME).set(err)
        time.sleep(2)

# ── Routes ────────────────────────────────────────────────────────────────
@app.route("/health")
def health():
    if SERVICE_STATE["crashed"]:
        return jsonify({"status": "down", "service": SERVICE_NAME}), 500
    # Quick DB ping
    db_ok = False
    try:
        conn = get_db(timeout=2); conn.close(); db_ok = True
    except Exception:
        pass
    return jsonify({"status": "ok", "service": SERVICE_NAME, "db": "ok" if db_ok else "degraded"})

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

@app.route("/pay", methods=["GET", "POST"])
def pay():
    REQ_C.labels(service=SERVICE_NAME).inc()
    with tracer.start_as_current_span("payment-process") as span:

        if SERVICE_STATE["crashed"]:
            ERR_C.labels(service=SERVICE_NAME).inc()
            span.set_attribute("error", True)
            log("ERROR", "Payment rejected — service crashed")
            return jsonify({"status": "error", "reason": "service_crashed"}), 500

        if SERVICE_STATE["db_fail"]:
            ERR_C.labels(service=SERVICE_NAME).inc()
            DB_ERR.labels(service=SERVICE_NAME).inc()
            span.set_attribute("error.type", "db_timeout")
            log("ERROR",
                "PostgreSQL query timeout in payment service — could not INSERT into payments table",
                db_host="postgres:5432", latency_ms=750, table="payments")
            return jsonify({
                "status": "error",
                "reason": "db_timeout",
                "detail": "FATAL: connection to server at postgres:5432 timed out"
            }), 500

        delay = (random.uniform(0.6, 1.0) if SERVICE_STATE["latency_mode"]
                 else random.uniform(0.05, 0.15))
        if SERVICE_STATE["latency_mode"]:
            log("WARN", "Slow payment processing", latency_ms=int(delay * 1000))
        time.sleep(delay)

        amount = random.randint(10, 500)
        body   = request.get_json(silent=True) or {}
        order_id = body.get("order_id")

        # Write to PostgreSQL
        payment_id = None
        db_latency = 0
        try:
            db_start = time.time()
            conn = get_db()
            cur  = conn.cursor()
            cur.execute(
                "INSERT INTO payments (order_id, amount, status, latency_ms) "
                "VALUES (%s, %s, %s, %s) RETURNING id",
                (order_id, amount, "success", int(delay * 1000))
            )
            payment_id = cur.fetchone()[0]
            conn.commit(); cur.close(); conn.close()
            db_latency = round((time.time() - db_start) * 1000, 1)
            span.set_attribute("db.payment_id", payment_id)
            DB_Q.labels(service=SERVICE_NAME).set(db_latency)
        except Exception as e:
            DB_ERR.labels(service=SERVICE_NAME).inc()
            log("WARN", "DB write failed — returning success without persistence",
                error=str(e)[:100])

        log("INFO", "Payment processed",
            payment_id=payment_id, amount=amount,
            latency_ms=int(delay * 1000), db_latency_ms=db_latency)
        span.set_attribute("payment.amount", amount)
        return jsonify({
            "status":     "ok",
            "payment_id": payment_id,
            "amount":     amount,
            "latency_ms": int(delay * 1000),
            "db_latency_ms": db_latency,
            "backend":    "postgresql"
        })

@app.route("/payments", methods=["GET"])
def list_payments():
    """Expose recent payments from PostgreSQL for dashboard."""
    try:
        conn = get_db()
        cur  = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("SELECT * FROM payments ORDER BY created_at DESC LIMIT 20")
        rows = [dict(r) for r in cur.fetchall()]
        cur.close(); conn.close()
        return jsonify({"payments": rows, "count": len(rows)})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    start_http_server(8000)
    threading.Thread(target=_sim, daemon=True).start()
    threading.Thread(target=init_db, daemon=True).start()
    log("INFO", "Payment service started", app_port=5002, metrics_port=8000,
        db="postgresql")
    app.run(host="0.0.0.0", port=5002)
