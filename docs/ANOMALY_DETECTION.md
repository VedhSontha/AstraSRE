# Isolation Forest Anomaly Detection

Detailed math and logic behind the anomaly detection system:
- Feature vector per service: $V = [CPU\%, Latency, Error\%]$.
- Standard training sample size: 600 baseline normal runs.
- Normalization scales raw score to a $[0, 1]$ interval.
