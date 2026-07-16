# SRE Recovery Docker Fallbacks

Handling Docker Daemon unreachability:
- If the Docker daemon is unreachable, the orchestrator falls back to a REST state reset.
- A state reset calls the target service's `/state` endpoint to restore its internal failure flags to normal.
