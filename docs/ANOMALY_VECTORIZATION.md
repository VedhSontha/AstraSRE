# Telemetry Metrics Vectorization

Converting Prometheus scrapes into feature matrices:
- Scraper collects raw metric lists every 5 seconds.
- Aggregates features: CPU utilization, latency, and error counts.
- Passes feature arrays to the Isolation Forest model prediction endpoints.
