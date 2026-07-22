# Runbook: High Latency Spike

## Symptoms
- P95 latency exceeds 500ms for more than 2 consecutive scrape cycles.
- Anomaly score surpasses 0.75 threshold.

## Diagnosis
1. Check Jaeger traces for slow spans.
2. Query Prometheus: `histogram_quantile(0.95, rate(request_duration_seconds_bucket[5m]))`.
3. Inspect Loki logs for database connection pool exhaustion.

## Remediation
- Scale the affected service replicas via HPA.
- If DB-bound, flush idle connections and increase pool size.
