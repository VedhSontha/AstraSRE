"""
AstraSRE — Load Generator
Continuously drives real HTTP traffic through the service chain
so Prometheus always has meaningful metrics to display.

Endpoints hit:
  - frontend /request  (full chain: frontend→order→inventory→payment)
  - order    /order    (chain: order→inventory→payment)

Also runs periodic bursts to create interesting metric spikes.
"""
import requests
import time
import random
import threading
import json
import os

FRONTEND_URL     = os.getenv("FRONTEND_URL",     "http://frontend:5000")
ORDER_URL        = os.getenv("ORDER_URL",         "http://order:5001")
INVENTORY_URL    = os.getenv("INVENTORY_URL",     "http://inventory:5003")
NOTIFICATION_URL = os.getenv("NOTIFICATION_URL",  "http://notification:5004")

# Steady-state request targets
TARGETS = [
    (f"{FRONTEND_URL}/request",       0.8, 2.5),  # (url, min_delay, max_delay)
    (f"{ORDER_URL}/order",            1.0, 3.0),
    (f"{INVENTORY_URL}/check",        1.5, 4.0),
    (f"{NOTIFICATION_URL}/notify",    2.0, 5.0),   # POST, handled below
]


def log(msg):
    print(json.dumps({
        "ts":      time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "service": "loadgen",
        "level":   "INFO",
        "message": msg
    }), flush=True)


def hit_get(url: str, min_d: float, max_d: float):
    """Steady GET traffic with jittered delay."""
    svc = url.split("/")[2].split(":")[0]
    log(f"Starting steady traffic → {url}")
    ok = err = 0
    while True:
        try:
            r = requests.get(url, timeout=5)
            if r.status_code < 400:
                ok += 1
            else:
                err += 1
        except Exception:
            err += 1
        if (ok + err) % 50 == 0:
            log(f"{svc} traffic: {ok} ok / {err} err")
        time.sleep(random.uniform(min_d, max_d))


def hit_notification():
    """POST traffic to notification."""
    log("Starting notification traffic")
    while True:
        try:
            requests.post(
                f"{NOTIFICATION_URL}/notify",
                json={"event": "loadgen_ping", "source": "loadgen"},
                timeout=3
            )
        except Exception:
            pass
        time.sleep(random.uniform(2.0, 6.0))


def burst(url: str, count: int = 15, delay: float = 0.08):
    """Send a rapid burst of requests to spike metrics."""
    for _ in range(count):
        try:
            requests.get(url, timeout=3)
        except Exception:
            pass
        time.sleep(delay)


def burst_scheduler():
    """Every 60s run a random burst to create interesting metric patterns."""
    burst_targets = [
        f"{FRONTEND_URL}/request",
        f"{ORDER_URL}/order",
        f"{INVENTORY_URL}/check",
    ]
    while True:
        time.sleep(60)
        url = random.choice(burst_targets)
        count = random.randint(10, 20)
        log(f"💥 Burst: {count} requests → {url}")
        burst(url, count)


def health_reporter():
    """Every 30s log summary of service health."""
    services = {
        "frontend":    f"{FRONTEND_URL}/health",
        "order":       f"{ORDER_URL}/health",
        "inventory":   f"{INVENTORY_URL}/health",
        "notification":f"{NOTIFICATION_URL}/health",
    }
    while True:
        time.sleep(30)
        statuses = {}
        for svc, url in services.items():
            try:
                r = requests.get(url, timeout=2)
                statuses[svc] = "ok" if r.status_code == 200 else f"err:{r.status_code}"
            except Exception:
                statuses[svc] = "unreachable"
        log(f"Health snapshot: {statuses}")


# ── Boot ─────────────────────────────────────────────────────────────────────
log("AstraSRE Load Generator starting...")
time.sleep(10)  # Wait for services to be ready

# Start steady traffic threads
for url, mn, mx in TARGETS[:-1]:  # skip notification (POST)
    threading.Thread(target=hit_get, args=(url, mn, mx), daemon=True).start()

threading.Thread(target=hit_notification, daemon=True).start()
threading.Thread(target=burst_scheduler,  daemon=True).start()
threading.Thread(target=health_reporter,  daemon=True).start()

log(f"Load generator active — {len(TARGETS)} target endpoints")

while True:
    time.sleep(60)
