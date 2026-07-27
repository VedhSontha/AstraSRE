# SRE Recovery Metrics (MTTR & MTTD)

Metrics tracked by AstraSRE self-healing controller:
- **MTTD (Mean Time To Detect)**: target < 5 seconds.
- **MTTR (Mean Time To Remediate)**: target < 15 seconds.
- Measured from chaos injection timestamp to service `/health` status 200 OK.
