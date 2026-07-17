# Orchestrator Loop Control Intervals

Synchronizing SRE checks:
- Loop interval configured via `LOOP_INTERVAL` (default: 5 seconds).
- Telemetry gathering and anomaly prediction are executed sequentially.
- Event status updates are broadcast via WebSockets at the end of each iteration.
