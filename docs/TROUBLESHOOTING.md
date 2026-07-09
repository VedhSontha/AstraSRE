# AstraSRE Troubleshooting Guide

Common failure modes and manual mitigations:
- **Loki connection refused**: Ensure `loki` container is running and port 3100 is accessible.
- **Docker socket permission errors**: Verify SRE orchestrator has read/write mounts to `/var/run/docker.sock`.
- **Database connection timeouts**: Flush payment connections and check Postgres pool status.
