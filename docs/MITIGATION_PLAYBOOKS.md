# Auto-Remediation Playbooks

Mitigation actions triggered by the SRE Orchestrator:
- **Service restart**: runs `docker restart` or triggers Kubernetes pod replacement.
- **Service scaling**: scales Deployment replica counts up to 5 via HPA.
- **Cache flush**: triggers Redis cache reclear and warm-up for inventory service.
