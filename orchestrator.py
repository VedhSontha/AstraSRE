"""
AstraSRE — Main Orchestrator
The SRE brain: collects metrics → detects anomalies → RCA → acts → LLM report → broadcasts.

Endpoints:
  POST /inject        { "service": "payment", "type": "db_timeout" }
  POST /heal          { "service": "payment" }
  POST /reset         (heal all)
  GET  /status        current system snapshot
  GET  /logs          recent Loki logs
  GET  /mttr          MTTR history
  GET  /graph         service dependency graph

Socket.io event "update" emitted every LOOP_INTERVAL seconds.
"""
import sys
import os

# Make ai/ and chaos/ importable
sys.path.insert(0, os.path.dirname(__file__))

from flask import Flask, jsonify, request
from flask_socketio import SocketIO
from flask_cors import CORS
import threading
import time
import requests as http
import json
import psutil

from ai.isolation_forest  import AnomalyDetector
from ai.metric_collector  import collect_metrics, collect_raw_metrics
from ai.rca_engine        import find_root_cause, explain_graph
from ai.llm_agent         import generate_incident_report
from chaos.chaos_controller import (inject_failure, heal_service, heal_all,
                                    get_all_states, CHAOS_LOG)
from chaos.action_engine  import decide_action, execute_action, get_mttr_history

# ── App setup ────────────────────────────────────────────────────────────
app      = Flask(__name__)
CORS(app, origins="*")
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="threading")

LOKI_URL            = os.getenv("LOKI_URL",            "http://loki:3100")
LOOP_INTERVAL       = int(os.getenv("LOOP_INTERVAL",   "5"))   # seconds
DISCORD_WEBHOOK_URL = os.getenv("DISCORD_WEBHOOK_URL", "")


# ── Discord Alert (──────────────────────────────────────────────────

SEV_COLOR = {"CRITICAL": 0xFF2222, "WARNING": 0xFF8C00, "NORMAL": 0x00FF88}

def send_discord_alert(root_cause: dict, action_result: dict, report: str) -> None:
    """Fire a rich Discord embed when the AI autonomously resolves a breach."""
    if not DISCORD_WEBHOOK_URL:
        return
    svc      = root_cause.get("service", "unknown")
    severity = root_cause.get("severity", "UNKNOWN")
    score    = round(root_cause.get("score", 0) * 100, 1)
    action   = action_result.get("action", "none")
    rec_time = action_result.get("recovery_time", 0.0)
    recovered = action_result.get("recovered", False)
    color    = SEV_COLOR.get(severity, 0xFFFFFF)
    status   = "✅ Recovered" if recovered else "❌ Unresolved"

    payload = {
        "username": "SentinelAI 🚀",
        "avatar_url": "https://cdn.discordapp.com/embed/avatars/0.png",
        "embeds": [{
            "title": f"🚨 BREACH DETECTED — {svc.upper()}",
            "description": report[:1024] if report else "Autonomous analysis in progress...",
            "color": color,
            "fields": [
                {"name": "🔴 Severity",       "value": severity,              "inline": True},
                {"name": "🤖 Confidence",    "value": f"{score}%",          "inline": True},
                {"name": "⚡ Action Taken",   "value": action.upper(),        "inline": True},
                {"name": "⏱ Recovery Time",  "value": f"{rec_time:.1f}s",     "inline": True},
                {"name": "🛡 Status",       "value": status,                "inline": True},
            ],
            "footer": {"text": "SentinelAI Autonomous SRE · Mars Colony Survival System"},
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }]
    }
    try:
        resp = http.post(DISCORD_WEBHOOK_URL, json=payload, timeout=5)
        if resp.status_code in (200, 204):
            print(f"[Discord] ✅ Alert fired for {svc} breach", flush=True)
        else:
            print(f"[Discord] ⚠  Webhook returned {resp.status_code}", flush=True)
    except Exception as exc:
        print(f"[Discord] ⚠  Failed to send alert: {exc}", flush=True)

# ── State ────────────────────────────────────────────────────────────────
detector        = AnomalyDetector(window_size=3)
latest_snapshot = {}          # last broadcast, served via /status
recent_reports  = []          # last 20 incident reports
orchestrator_state = {        # mutable ref so /reset can clear it
    "last_root_cause": None,
    "last_report":     "System starting up...",
    "last_action":     {"action": None, "service": None, "recovered": False, "recovery_time": 0.0},
}

# ── Loki log fetcher ─────────────────────────────────────────────────────

def fetch_loki_logs(service: str = "", limit: int = 30) -> list[str]:
    try:
        query = f'{{service="{service}"}}' if service else '{service=~".+"}'
        r = http.get(
            f"{LOKI_URL}/loki/api/v1/query_range",
            params={
                "query": query,
                "limit": limit,
                "start": int((time.time() - 300) * 1e9),
                "end":   int(time.time() * 1e9),
                "direction": "backward",
            },
            timeout=3,
        )
        results = r.json()["data"]["result"]
        lines = []
        for stream in results:
            for ts, msg in stream.get("values", []):
                lines.append(msg)
        return lines[:limit]
    except Exception:
        return []


# ── Main detection loop ───────────────────────────────────────────────────

def detection_loop():
    print("[Orchestrator] Training Isolation Forest...", flush=True)
    detector.train()
    print("[Orchestrator] Detection loop started.", flush=True)

    # Use orchestrator_state dict so REST endpoints can reset these
    orchestrator_state["last_action"]     = {"action": None, "service": None, "recovered": False, "recovery_time": 0.0}
    orchestrator_state["last_root_cause"] = None
    orchestrator_state["last_report"]     = "System starting up..."

    while True:
        try:
            # 1. Collect metrics from Prometheus
            metrics     = collect_metrics()
            metrics_raw = collect_raw_metrics()

            # 2. Run Isolation Forest
            anomaly_scores = detector.predict(metrics)

            # 3. RCA
            anomalies   = {k: v for k, v in anomaly_scores.items() if v["is_anomaly"]}
            root_cause  = find_root_cause(anomaly_scores) if anomalies else None

            # 3a. If breach detected → trigger real compute spike (makes psutil CPU genuine)
            if anomalies:
                label = f"BREACH_ANALYSIS:{list(anomalies.keys())[0].upper()}"
                detector.spike_compute(label=label)

            # 4. Decide & act
            if root_cause:
                svc    = root_cause["service"]
                action = decide_action(root_cause, anomaly_scores[svc])
                if action:
                    action_result = execute_action(svc, action)
                    action_result["service"] = svc
                    orchestrator_state["last_action"] = action_result

                    # 5. LLM incident report
                    logs_raw  = fetch_loki_logs(svc, limit=5)
                    logs_text = "\n".join(logs_raw)
                    report = generate_incident_report(
                        anomaly_scores  = anomaly_scores,
                        root_cause      = root_cause,
                        action_result   = action_result,
                        recent_logs     = logs_text,
                        metrics_raw     = metrics_raw,
                    )
                    orchestrator_state["last_report"] = report
                    recent_reports.append({
                        "ts":     time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                        "report": report,
                    })
                    if len(recent_reports) > 20:
                        recent_reports.pop(0)

                    # 🔔 Fire Discord alert (runs in background so it doesn’t block the loop)
                    threading.Thread(
                        target=send_discord_alert,
                        args=(root_cause, action_result, report),
                        daemon=True
                    ).start()

                orchestrator_state["last_root_cause"] = root_cause
            else:
                orchestrator_state["last_root_cause"] = None

            # 6. Build snapshot
            host_cpu  = psutil.cpu_percent(interval=None)
            host_mem  = psutil.virtual_memory().percent
            snapshot = {
                "ts":             time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "anomaly_scores": anomaly_scores,
                "anomalies":      anomalies,
                "root_cause":     orchestrator_state["last_root_cause"],
                "last_action":    orchestrator_state["last_action"],
                "report":         orchestrator_state["last_report"],
                "metrics_raw":    metrics_raw,
                "mttr_history":   get_mttr_history()[-10:],
                "graph":          explain_graph(),
                "chaos_log":      CHAOS_LOG[-10:],
                "host_metrics":   {"cpu": round(host_cpu, 1), "mem": round(host_mem, 1)},
            }
            latest_snapshot.update(snapshot)

            # 7. Broadcast to dashboard
            socketio.emit("update", snapshot)

        except Exception as e:
            print(f"[Orchestrator] Loop error: {e}", flush=True)

        time.sleep(LOOP_INTERVAL)


# ── REST Endpoints ────────────────────────────────────────────────────────

@app.route("/inject", methods=["POST"])
def api_inject():
    data    = request.get_json() or {}
    service = data.get("service", "payment")
    ftype   = data.get("type", "latency")
    result  = inject_failure(service, ftype)
    return jsonify(result)


@app.route("/heal", methods=["POST"])
def api_heal():
    data    = request.get_json() or {}
    service = data.get("service")
    if service:
        result = heal_service(service)
    else:
        result = heal_all()
        # Clear orchestrator state so dashboard reflects healed state immediately
        orchestrator_state["last_root_cause"] = None
        orchestrator_state["last_report"]     = "All services healed. Monitoring for new anomalies..."
        orchestrator_state["last_action"]     = {"action": None, "service": None, "recovered": True, "recovery_time": 0.0}
        latest_snapshot.update({
            "root_cause": None,
            "report":     orchestrator_state["last_report"],
            "anomalies":  {},
        })
    return jsonify(result)


@app.route("/reset", methods=["POST"])
def api_reset():
    result = heal_all()
    orchestrator_state["last_root_cause"] = None
    orchestrator_state["last_report"]     = "System reset. Monitoring for new anomalies..."
    orchestrator_state["last_action"]     = {"action": None, "service": None, "recovered": True, "recovery_time": 0.0}
    latest_snapshot.update({
        "root_cause": None,
        "report":     orchestrator_state["last_report"],
        "anomalies":  {},
    })
    return jsonify({"reset": result})


@app.route("/status", methods=["GET"])
def api_status():
    return jsonify(latest_snapshot)


@app.route("/logs", methods=["GET"])
def api_logs():
    service = request.args.get("service", "")
    limit   = int(request.args.get("limit", 50))
    logs    = fetch_loki_logs(service, limit)
    return jsonify({"logs": logs, "count": len(logs)})


@app.route("/mttr", methods=["GET"])
def api_mttr():
    return jsonify({"mttr": get_mttr_history()})


@app.route("/graph", methods=["GET"])
def api_graph():
    return jsonify(explain_graph())


@app.route("/health", methods=["GET"])
def api_health():
    return jsonify({"status": "ok", "service": "orchestrator"})


# ── Boot ──────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    t = threading.Thread(target=detection_loop, daemon=True)
    t.start()
    print("[Orchestrator] Starting on port 5010", flush=True)
    socketio.run(app, host="0.0.0.0", port=5010, allow_unsafe_werkzeug=True)
