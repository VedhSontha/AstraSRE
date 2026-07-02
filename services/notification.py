from flask import Flask, jsonify, request
from prometheus_client import Gauge, Counter, start_http_server
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
import threading, time, random, json, os
import requests as http

app = Flask(__name__)

SERVICE_NAME = "notification"
LOKI_URL     = os.getenv("LOKI_URL",      "http://loki:3100")
OTLP_EP      = os.getenv("OTLP_ENDPOINT", "http://jaeger:4318/v1/traces")

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

def _sim():
    while True:
        s = SERVICE_STATE
        if s["crashed"]:
            cpu, lat, err = random.uniform(0,5), 9999.0, 100.0
        elif s["db_fail"]:
            cpu = random.uniform(60, 80); lat = random.uniform(400, 600); err = random.uniform(20, 35)
        elif s["latency_mode"]:
            cpu = random.uniform(40, 60); lat = random.uniform(300, 500); err = random.uniform(3, 10)
        else:
            cpu = random.uniform(5, 20)
            lat = 80 + random.uniform(-10, 20)
            err = max(0, random.uniform(-0.2, 0.5))
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

@app.route("/notify", methods=["POST"])
def notify():
    REQ_C.labels(service=SERVICE_NAME).inc()
    with tracer.start_as_current_span("notification-send") as span:
        if SERVICE_STATE["crashed"]:
            ERR_C.labels(service=SERVICE_NAME).inc()
            return jsonify({"status": "error", "reason": "service_crashed"}), 500

        data = request.get_json() or {}
        event = data.get("event", "unknown")

        if SERVICE_STATE["db_fail"]:
            ERR_C.labels(service=SERVICE_NAME).inc()
            log("ERROR", "Notification queue overflow — message dropped", event=event)
            return jsonify({"status": "error", "reason": "queue_full"}), 500

        if SERVICE_STATE["latency_mode"]:
            time.sleep(random.uniform(0.2, 0.4))

        log("INFO", f"Notification dispatched: {event}", event_data=data)
        span.set_attribute("notification.event", event)
        return jsonify({"status": "ok", "event": event,
                        "channel": "email+slack", "delivered": True})

if __name__ == "__main__":
    start_http_server(8004)
    threading.Thread(target=_sim, daemon=True).start()
    log("INFO", "Notification service started", app_port=5004, metrics_port=8004)
    app.run(host="0.0.0.0", port=5004)
