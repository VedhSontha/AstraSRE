import requests
from typing import Dict

def check_service_health(host: str, port: int) -> Dict[str, bool]:
    """Probes a microservice /health endpoint and returns readiness status."""
    url = f"http://{host}:{port}/health"
    try:
        resp = requests.get(url, timeout=2.0)
        return {"reachable": True, "healthy": resp.status_code == 200}
    except requests.ConnectionError:
        return {"reachable": False, "healthy": False}
