from flask import Flask, jsonify, request
from prometheus_client import Gauge, Counter, start_http_server
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
import threading, time, random, json, os
import requests as http

app = Flask(__name__)

SERVICE_NAME = "frontend"
LOKI_URL     = os.getenv("LOKI_URL",      "http://loki:3100")
OTLP_EP      = os.getenv("OTLP_ENDPOINT", "http://jaeger:4318/v1/traces")
ORDER_URL    = os.getenv("ORDER_URL",     "http://order:5001")

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
    # Console logger output
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

@app.route("/", methods=["GET"])
@app.route("/request", methods=["GET"])
def frontend():
    REQ_C.labels(service=SERVICE_NAME).inc()
    start = time.time()
    with tracer.start_as_current_span("frontend-request") as span:
        if SERVICE_STATE["crashed"]:
            ERR_C.labels(service=SERVICE_NAME).inc()
            return jsonify({"frontend_status": "error", "reason": "service_crashed"}), 500

        if SERVICE_STATE["latency_mode"]:
            time.sleep(random.uniform(0.2, 0.5))

        try:
            res = http.get(f"{ORDER_URL}/order", timeout=5)
            data = res.json()
            latency = round(time.time() - start, 3)

            if res.status_code != 200:
                ERR_C.labels(service=SERVICE_NAME).inc()
                span.set_attribute("error", True)
                log("ERROR", "Frontend: order service failed", latency=latency, detail=data)
                return jsonify({"frontend_status": "error", "order_response": data,
                                "latency": latency}), 500

            log("INFO", "Frontend: request served", latency=latency)
            return jsonify({"frontend_status": "ok", "order_response": data,
                            "latency": latency})

        except Exception as e:
            ERR_C.labels(service=SERVICE_NAME).inc()
            log("ERROR", "Frontend: cannot reach order", error=str(e))
            return jsonify({"frontend_status": "error", "error": str(e)}), 500

if __name__ == "__main__":
    start_http_server(8003)
    threading.Thread(target=_sim, daemon=True).start()
    log("INFO", "Frontend service started", app_port=5000, metrics_port=8003)
    app.run(host="0.0.0.0", port=5000)
