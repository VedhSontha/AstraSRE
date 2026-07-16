# AstraSRE Orchestrator Architecture

Control loop flow executed by the SRE brain:
1. Metrics Scrape: queries Prometheus instant API.
2. Anomaly Classifier: runs Isolation Forest prediction checks.
3. Graph RCA: BFS dependency traversal.
4. Auto-Remediation: triggers restart/scale playbooks.
