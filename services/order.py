"""
order service — writes orders to REAL PostgreSQL
Flow: order created in DB → call inventory → update order status
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
    HAS_PG = True
except ImportError:
    HAS_PG = False

app = Flask(__name__)

SERVICE_NAME     = "order"
LOKI_URL         = os.getenv("LOKI_URL",          "http://loki:3100")
OTLP_EP          = os.getenv("OTLP_ENDPOINT",     "http://jaeger:4318/v1/traces")
INVENTORY_URL    = os.getenv("INVENTORY_URL",     "http://inventory:5003")
NOTIFICATION_URL = os.getenv("NOTIFICATION_URL",  "http://notification:5004")
DATABASE_URL      = os.getenv("DATABASE_URL",
    "postgresql://astrasre:astrasre123@postgres:5432/astrasre")

SERVICE_STATE = {"latency_mode": False, "db_fail": False, "crashed": False}

CPU_G = Gauge('cpu_usage_percent',  'CPU %',      ['service'])
LAT_G = Gauge('latency_ms',         'Latency ms', ['service'])
ERR_G = Gauge('error_rate_percent', 'Error %',    ['service'])
REQ_C = Counter('request_total',    'Requests',   ['service'])
ERR_C = Counter('error_total',      'Errors',     ['service'])

try:
    _prov = TracerProvider()
    _prov.add_span_processor(BatchSpanProcessor(OTLPSpanExporter(endpoint=OTLP_EP)))
    trace.set_tracer_provider(_prov)
except Exception:
    pass
tracer = trace.get_tracer(SERVICE_NAME)

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

def get_db(timeout=3):
    if not HAS_PG:
        raise RuntimeError("psycopg2 not installed")
    return psycopg2.connect(DATABASE_URL, connect_timeout=timeout)

def _create_order_in_db(amount):
    """INSERT new order, return order_id."""
    try:
        conn = get_db()
        cur  = conn.cursor()
        cur.execute(
            "INSERT INTO orders (status, total_amount) VALUES (%s, %s) RETURNING id",
            ("pending", amount)
        )
        order_id = cur.fetchone()[0]
        conn.commit(); cur.close(); conn.close()
        return order_id
    except Exception as e:
        log("WARN", "Could not create order in DB", error=str(e)[:80])
        return None

def _update_order_status(order_id, status):
    try:
        conn = get_db()
        cur  = conn.cursor()
        cur.execute("UPDATE orders SET status=%s WHERE id=%s", (status, order_id))
        conn.commit(); cur.close(); conn.close()
    except Exception:
        pass

def _sim():
    while True:
        s = SERVICE_STATE
        if s["crashed"]:
            cpu, lat, err = random.uniform(0,5), 9999.0, 100.0
        elif s["db_fail"]:
            cpu = random.uniform(75, 95); lat = random.uniform(600, 900); err = random.uniform(25, 40)
        elif s["latency_mode"]:
            cpu = random.uniform(60, 80); lat = random.uniform(400, 700); err = random.uniform(5, 15)
        else:
            cpu = random.uniform(10, 30)
            lat = 120 + (cpu - 10) * 2 + random.uniform(-15, 15)
            err = max(0, random.uniform(-0.5, 1.0))
        CPU_G.labels(service=SERVICE_NAME).set(cpu)
        LAT_G.labels(service=SERVICE_NAME).set(lat)
        ERR_G.labels(service=SERVICE_NAME).set(err)
        time.sleep(2)

@app.route("/health")
def health():
    if SERVICE_STATE["crashed"]:
        return jsonify({"status": "down", "service": SERVICE_NAME}), 500
    return jsonify({"status": "ok", "service": SERVICE_NAME})

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

def _notify(event, detail=None):
    try:
        http.post(f"{NOTIFICATION_URL}/notify",
                  json={"event": event, "detail": detail}, timeout=1)
    except Exception:
        pass

@app.route("/order", methods=["GET", "POST"])
def order():
    REQ_C.labels(service=SERVICE_NAME).inc()
    start = time.time()
    with tracer.start_as_current_span("order-process") as span:

        if SERVICE_STATE["crashed"]:
            ERR_C.labels(service=SERVICE_NAME).inc()
            return jsonify({"status": "error", "reason": "service_crashed"}), 500

        if SERVICE_STATE["db_fail"]:
            ERR_C.labels(service=SERVICE_NAME).inc()
            log("ERROR", "PostgreSQL timeout on ORDER INSERT", latency_ms=800)
            return jsonify({"status": "error", "reason": "db_timeout",
                            "detail": "FATAL: order table INSERT timed out"}), 500

        if SERVICE_STATE["latency_mode"]:
            time.sleep(random.uniform(0.3, 0.6))

        # Create order record first
        amount   = random.randint(10, 500)
        order_id = _create_order_in_db(amount)

        try:
            inv_res  = http.get(f"{INVENTORY_URL}/check", timeout=4)
            inv_data = inv_res.json()

            if inv_res.status_code != 200:
                ERR_C.labels(service=SERVICE_NAME).inc()
                span.set_attribute("error", True)
                log("ERROR", "Inventory check failed — order aborted", detail=inv_data)
                _update_order_status(order_id, "failed")
                _notify("order_failed", inv_data)
                return jsonify({"status": "error", "reason": "inventory_failure",
                                "detail": inv_data}), 500

            latency = round(time.time() - start, 3)
            _update_order_status(order_id, "completed")
            log("INFO", "Order processed", order_id=order_id, amount=amount, latency=latency)
            span.set_attribute("order.id", order_id or 0)
            _notify("order_success", {"order_id": order_id, "latency": latency})
            return jsonify({"status": "ok", "order_id": order_id,
                            "amount": amount, "inventory": inv_data,
                            "latency": latency, "backend": "postgresql"})

        except Exception as e:
            ERR_C.labels(service=SERVICE_NAME).inc()
            log("ERROR", "Cannot reach inventory", error=str(e))
            _update_order_status(order_id, "failed")
            _notify("order_failed", {"error": str(e)})
            return jsonify({"status": "error", "reason": str(e)}), 500

if __name__ == "__main__":
    start_http_server(8001)
    threading.Thread(target=_sim, daemon=True).start()
    log("INFO", "Order service started", app_port=5001, metrics_port=8001, db="postgresql")
    app.run(host="0.0.0.0", port=5001)
