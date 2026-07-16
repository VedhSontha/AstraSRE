# Action Cooldown Locking Policies

Preventing remediation thrashing in SRE runs:
- Lock parameters: `COOLDOWN_SECONDS = 30` (in-memory hash).
- Checks active lock state before triggering redundant restarts/scaling actions.
