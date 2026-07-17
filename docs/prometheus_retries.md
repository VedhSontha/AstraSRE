# Prometheus Query Error Resilience

Scraper timeout and error parameters:
- Queries default to a `4.0` second timeout limit.
- Returns a zero feature matrix (`0.0`) if Prometheus queries fail or time out.
- Prevents the anomaly detection loop from stalling on network partitions.
