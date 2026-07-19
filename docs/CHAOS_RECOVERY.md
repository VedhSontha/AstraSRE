# Manual Chaos Recovery Guidelines

If automated remediation fails, SRE teams can trigger manual recovery:
1. Verify container runtime state via `docker ps`.
2. Inspect log files directly in the log repository.
3. Call the manual restart route `/state/reset` to flush flags.
