"""
AstraSRE — Chaos Controller
Injects failures into services via their /state endpoint.
Supports: latency, db_timeout, crash, network_partition (simulated)
"""
import requests
import os
import time

SERVICE_URLS: dict[str, str] = {
    "payment":      os.getenv("PAYMENT_URL",      "http://payment:5002"),
    "order":        os.getenv("ORDER_URL",         "http://order:5001"),
    "inventory":    os.getenv("INVENTORY_URL",     "http://inventory:5003"),
    "frontend":     os.getenv("FRONTEND_URL",      "http://frontend:5000"),
    "notification": os.getenv("NOTIFICATION_URL",  "http://notification:5004"),
}

# Chaos event log (in-memory for dashboard)
CHAOS_LOG: list[dict] = []


def _set_state(service: str, payload: dict) -> dict:
    url = SERVICE_URLS.get(service)
    if not url:
        return {"ok": False, "error": f"Unknown service: {service}"}
    try:
        r = requests.post(f"{url}/state", json=payload, timeout=3)
        return {"ok": True, "status": r.status_code, "state": payload}
    except Exception as e:
        return {"ok": False, "error": str(e)}


def inject_failure(service: str, failure_type: str) -> dict:
    """
    failure_type: "latency" | "db_timeout" | "crash" | "all"
    """
    print(f"[CHAOS] ▶ Injecting {failure_type} into {service}", flush=True)

    state_map = {
        "latency":     {"latency_mode": True,  "db_fail": False, "crashed": False},
        "db_timeout":  {"latency_mode": False, "db_fail": True,  "crashed": False},
        "crash":       {"latency_mode": False, "db_fail": False, "crashed": True},
        "all":         {"latency_mode": True,  "db_fail": True,  "crashed": False},
    }
    payload = state_map.get(failure_type, {"latency_mode": False, "db_fail": False, "crashed": False})
    result = _set_state(service, payload)

    event = {
        "ts":           time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "type":         "inject",
        "service":      service,
        "failure_type": failure_type,
        "ok":           result.get("ok", False),
    }
    CHAOS_LOG.append(event)
    if len(CHAOS_LOG) > 100:
        CHAOS_LOG.pop(0)

    return {**result, **event}


def heal_service(service: str) -> dict:
    """Reset service to normal state."""
    print(f"[CHAOS] ✅ Healing {service}", flush=True)
    result = _set_state(service, {"latency_mode": False, "db_fail": False, "crashed": False})

    event = {
        "ts":      time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "type":    "heal",
        "service": service,
        "ok":      result.get("ok", False),
    }
    CHAOS_LOG.append(event)
    return {**result, **event}


def heal_all() -> dict:
    results = {}
    for service in SERVICE_URLS:
        results[service] = heal_service(service)
    return results


def check_health(service: str) -> bool:
    url = SERVICE_URLS.get(service)
    if not url:
        return False
    try:
        r = requests.get(f"{url}/health", timeout=3)
        return r.status_code == 200
    except Exception:
        return False


def get_all_states() -> dict:
    states = {}
    for service, url in SERVICE_URLS.items():
        try:
            r = requests.get(f"{url}/state", timeout=2)
            states[service] = r.json()
        except Exception:
            states[service] = {"error": "unreachable"}
    return states
