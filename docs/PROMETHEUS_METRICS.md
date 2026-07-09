# AstraSRE Prometheus Metrics Guide

Monitoring service health using Prometheus client library:
- Metrics collected: `cpu_usage_percent`, `latency_ms`, `error_rate_percent`, `db_query_duration_ms`.
- Metrics are queried using PromQL to populate features for the Isolation Forest anomaly detector.
