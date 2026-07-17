# Loki Query Performance Tuning

Optimizing log extraction throughput under peak load:
- Queries are restricted to a rolling 300-second window.
- Retains backward sorting (`direction: "backward"`) to prioritize recent logs.
- Prevents database socket exhaustion by limiting returned lines to 30.
