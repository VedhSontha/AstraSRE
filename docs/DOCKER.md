# AstraSRE Docker Orchestration Guide

Information on configuring and running the Docker Compose stack:
- Build command: `docker-compose up --build -d`
- Logging configuration uses Promtail to ship container logs to Loki on port 3100.
- Services publish their metrics on dedicated ports (`8000`-`8004`) for Prometheus scraping.
