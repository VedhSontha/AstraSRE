"""
AstraSRE — LLM Incident Agent
Priority: Groq (free API key) → Ollama (local) → Smart Template

The LLM prompt is tuned to produce conversational, human SRE-style narration —
not a dry formatted report. Think: "Slack message from your on-call teammate."

To use Groq (free): sign up at https://console.groq.com → get free API key → set GROQ_API_KEY env var
To use Ollama (local, no key): install Ollama, run: ollama pull llama3.2:3b
Fallback: auto-generates a natural-language template report with real metrics
"""
import requests
import os
import time
import json
import random

# ── Config ──────────────────────────────────────────────────────────────
GROQ_API_KEY  = os.getenv("GROQ_API_KEY",  "")
GROQ_MODEL    = "llama-3.3-70b-versatile"
GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions"

OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2:3b")
OLLAMA_URLS  = [
    os.getenv("OLLAMA_URL", "http://ollama:11434"),
    "http://host.docker.internal:11434",  # Docker Desktop (Win/Mac)
    "http://localhost:11434",             # native local
]


# ── LLM Backends ────────────────────────────────────────────────────────

def _try_groq(prompt: str) -> str | None:
    if not GROQ_API_KEY:
        return None
    try:
        r = requests.post(
            GROQ_ENDPOINT,
            headers={"Authorization": f"Bearer {GROQ_API_KEY}",
                     "Content-Type": "application/json"},
            json={"model": GROQ_MODEL,
                  "messages": [{"role": "user", "content": prompt}],
                  "max_tokens": 400},
            timeout=15,
        )
        r.raise_for_status()
        return r.json()["choices"][0]["message"]["content"].strip()
    except Exception as e:
        print(f"[LLM] Groq failed: {e}", flush=True)
        return None


def _try_ollama(prompt: str) -> str | None:
    for base_url in OLLAMA_URLS:
        try:
            r = requests.post(
                f"{base_url}/api/generate",
                json={"model": OLLAMA_MODEL, "prompt": prompt, "stream": False},
                timeout=45,
            )
            if r.status_code == 200:
                return r.json().get("response", "").strip()
        except Exception:
            continue
    print("[LLM] Ollama not reachable — using template fallback.", flush=True)
    return None


# ── Natural Language Template Fallback ──────────────────────────────────

_CAUSES = {
    "db_timeout": [
        "looks like a database connection timeout",
        "the Postgres connection pool appears to be exhausted",
        "database connections are timing out — probably a pool saturation issue",
    ],
    "latency": [
        "there's unexplained latency building up",
        "response times have spiked way above baseline",
        "something's adding serious latency to every request",
    ],
    "crash": [
        "the service appears to have crashed or restarted",
        "the process is repeatedly dying under load",
        "we're seeing crash-loop behavior",
    ],
}

_RECOVERY_PHRASES = {
    "restart": [
        "kicked off a restart",
        "bounced the service",
        "triggered an automated restart",
    ],
    "scale": [
        "scaled up replicas to absorb load",
        "bumped the replica count to handle demand",
        "horizontally scaled the deployment",
    ],
    "cache_recovery": [
        "flushed and reseeded the Redis cache",
        "ran a cache recovery to clear the stale entries",
        "triggered a Redis flush and cache warm-up",
    ],
}

def _natural_severity(score_pct: float) -> str:
    if score_pct >= 90:
        return "pretty severely"
    elif score_pct >= 75:
        return "fairly significantly"
    elif score_pct >= 60:
        return "noticeably"
    else:
        return "mildly"


def _template_report(anomaly_scores: dict, root_cause: dict,
                     action_result: dict, metrics_raw: dict | None = None) -> str:
    service   = root_cause["service"]
    severity  = root_cause.get("severity", "UNKNOWN")
    score_pct = round(root_cause.get("score", 0) * 100, 1)
    affected  = root_cause.get("affected", [])
    action    = action_result.get("action", "none")
    rec_time  = action_result.get("recovery_time", 0.0)
    recovered = action_result.get("recovered", False)
    ts        = time.strftime("%H:%M UTC", time.gmtime())

    # Figure out the likely failure cause from metrics or score
    has_real_metrics = False
    cpu_val = lat_val = err_val = 0.0
    if metrics_raw and service in metrics_raw:
        m = metrics_raw[service]
        cpu_val = m.get("cpu", 0.0)
        lat_val = m.get("latency_ms", 0.0)
        err_val = m.get("error_rate", 0.0)
        has_real_metrics = (cpu_val > 1 or lat_val > 10 or err_val > 0.5)

    severity_adv = _natural_severity(score_pct)

    # Build cause description
    if has_real_metrics:
        if err_val > 5:
            cause_hint = f"CPU hit {cpu_val:.0f}%, latency jumped to {lat_val:.0f}ms, and error rate is at {err_val:.1f}%"
        elif lat_val > 200:
            cause_hint = f"latency is {lat_val:.0f}ms (way above the normal 120ms baseline) with {cpu_val:.0f}% CPU"
        elif cpu_val > 60:
            cause_hint = f"CPU is pegged at {cpu_val:.0f}% which is saturating the service threads"
        else:
            cause_hint = f"metrics show CPU at {cpu_val:.0f}%, latency at {lat_val:.0f}ms, errors at {err_val:.1f}%"
    else:
        # No real Prometheus data — describe based on anomaly score
        cause_hint = f"the Isolation Forest model flagged it {severity_adv} — {score_pct}% confidence deviation from the 600-sample normal baseline"

    # Cascade description
    if affected:
        # Format affected nicely
        if len(affected) == 1:
            cascade = f"it cascaded into {affected[0]}"
        elif len(affected) == 2:
            cascade = f"it cascaded into {affected[0]} and {affected[1]}"
        else:
            cascade = f"it cascaded into {', '.join(affected[:-1])}, and {affected[-1]}"
    else:
        cascade = "blast radius appears contained — no other services affected"

    # Recovery description
    recovery_phrase = random.choice(_RECOVERY_PHRASES.get(action, ["triggered auto-remediation"]))
    if recovered:
        recovery_status = f"it came back healthy in {rec_time:.1f}s"
    else:
        recovery_status = f"still waiting on full recovery after {rec_time:.1f}s — might need manual attention"

    # Recommendation based on failure type
    if has_real_metrics and err_val > 10:
        recommendation = "Worth checking the Postgres connection pool limits and slow query logs."
    elif has_real_metrics and lat_val > 400:
        recommendation = "Check for upstream dependencies holding connections open."
    elif has_real_metrics and cpu_val > 70:
        recommendation = "Consider bumping the resource limits or checking for a memory leak."
    else:
        if "payment" in service:
            recommendation = "Double-check the DB connection pool config and Postgres health."
        elif "inventory" in service:
            recommendation = "Redis cache health is the first place to look."
        elif "order" in service:
            recommendation = "Check inventory and payment upstream dependencies."
        else:
            recommendation = "Check the service logs and upstream dependency health."

    return f"""[{ts}] Hey — {service} is having a rough time right now.

The ML model picked it up as {severity} ({score_pct}% confidence): {cause_hint}. From there, {cascade}.

We already {recovery_phrase} on {service} and {recovery_status}. {recommendation}

The anomaly scores confirm {service} as the root cause — the dependency graph shows it's upstream of everything else that degraded."""


# ── Public API ───────────────────────────────────────────────────────────

def generate_incident_report(
    anomaly_scores:  dict,
    root_cause:      dict | None,
    action_result:   dict,
    recent_logs:     str  = "",
    metrics_raw:     dict | None = None,
) -> str:
    if not root_cause:
        return "All systems nominal right now — no anomalies detected across any of the services."

    service   = root_cause["service"]
    score_pct = round(root_cause.get("score", 0) * 100, 1)
    affected  = root_cause.get("affected", [])
    action    = action_result.get("action", "none")
    recovered = action_result.get("recovered", False)
    rec_time  = action_result.get("recovery_time", 0.0)

    # Real metrics if available
    metrics_context = ""
    if metrics_raw and service in metrics_raw:
        m = metrics_raw[service]
        cpu = m.get("cpu", 0.0)
        lat = m.get("latency_ms", 0.0)
        err = m.get("error_rate", 0.0)
        if cpu > 1 or lat > 10 or err > 0.5:
            metrics_context = f"Live telemetry: CPU {cpu:.1f}%, latency {lat:.0f}ms, error rate {err:.1f}%."

    prompt = f"""You are a senior SRE (Site Reliability Engineer) writing a quick Slack message to your on-call team.
Explain this production incident in a natural, human, conversational tone — like you're talking to a teammate.
No bullet points, no headers, no markdown formatting. Just 3-4 sentences in plain English.
Be specific with numbers and service names. Keep it under 120 words.

INCIDENT DETAILS:
- Root cause service: {service} (anomaly confidence: {score_pct}%)
- Severity: {root_cause.get('severity', 'UNKNOWN')}
- Services also affected: {', '.join(affected) if affected else 'none'}
- Auto-remediation: {action} was executed on {service}
- Recovery: {'succeeded' if recovered else 'still pending'} in {rec_time:.1f}s
{metrics_context}

Recent logs (last 5):
{recent_logs[:500] if recent_logs else 'No logs yet.'}

Write ONLY the message text. No preamble like "Here is..." — just start with the explanation."""

    # Try LLM backends in order
    report = _try_groq(prompt) or _try_ollama(prompt)
    if report:
        return report

    # Natural language fallback
    return _template_report(anomaly_scores, root_cause, action_result, metrics_raw)
