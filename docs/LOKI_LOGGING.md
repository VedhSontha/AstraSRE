# AstraSRE Loki Logging Guide

Guide to log structured JSON entries from Flask services to Loki:
- Log Format: JSON lines containing `ts`, `service`, `level`, `message`.
- Loki query syntax for filtering errors: `{service="payment", level="ERROR"}`
- Queries are executed backward with a rolling 5-minute time range.
