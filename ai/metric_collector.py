"""
AstraSRE — Prometheus Metric Collector
Queries live Prometheus to feed the Isolation Forest detector.
"""
import requests
import os

PROMETHEUS_URL = os.getenv("PROMETHEUS_URL", "http://prometheus:9090")
SERVICES       = ["payment", "order", "inventory", "frontend", "notification"]


def _query(metric: str, service: str) -> float:
    """Query a single instant value from Prometheus."""
    try:
        r = requests.get(
            f"{PROMETHEUS_URL}/api/v1/query",
            params={"query": f'{metric}{{service="{service}"}}'},
            timeout=4.0,
        )
        result = r.json()["data"]["result"]
        return float(result[0]["value"][1]) if result else 0.0
    except Exception:
        return 0.0


def collect_metrics() -> dict:
    """
    Returns:
        { "payment": [cpu, latency, errors], ... }
    """
    metrics = {}
    for svc in SERVICES:
        cpu = _query("cpu_usage_percent",  svc)
        lat = _query("latency_ms",         svc)
        err = _query("error_rate_percent", svc)
        metrics[svc] = [cpu, lat, err]
    return metrics


def collect_raw_metrics() -> dict:
    """
    Returns human-readable dict for reporting:
        { "payment": {"cpu": 82.3, "latency_ms": 712, "error_rate": 31.4}, ... }
    """
    raw = {}
    for svc in SERVICES:
        raw[svc] = {
            "cpu":        round(_query("cpu_usage_percent",  svc), 1),
            "latency_ms": round(_query("latency_ms",         svc), 1),
            "error_rate": round(_query("error_rate_percent", svc), 1),
        }
    return raw
