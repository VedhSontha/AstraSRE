# Discord Alert Webhook Integration

Payload layout and thresholds for firing system breach alerts:
- Alerts are dispatched to `DISCORD_WEBHOOK_URL` in a background thread.
- Severity levels dictate color codes: `CRITICAL` (Red), `WARNING` (Orange), `NORMAL` (Green).
- Formats message logs detailing root-cause, confidence, recovery elapsed times, and status flags.
