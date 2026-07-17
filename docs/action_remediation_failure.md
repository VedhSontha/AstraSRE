# Recovery Verification Retries

Self-healing loop retry parameters:
- Validates recovery by querying target `/health` endpoints.
- Max check iterations: `10` attempts with 1-second intervals.
- If checks fail after 10 attempts, the service remains flagged as degraded.
