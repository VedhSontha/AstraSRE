# SRE Automated Remediation Rules

Remediation actions determined by severity scoring:
- `CRITICAL` anomaly with score $>0.85$ triggers a Docker container `restart`.
- `CRITICAL` anomaly with score $\le 0.85$ triggers a horizontal replica scale-out.
- Cooldown period prevents trigger loops on the same service within 30 seconds.
