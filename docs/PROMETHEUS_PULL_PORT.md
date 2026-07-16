# Prometheus Target Scraping Ports

Mapping scraper targets to microservice metrics endpoints:
- Scraper fetches values from path `/metrics`.
- Configured ports: `8000` (payment), `8001` (order), `8002` (inventory), `8003` (frontend), `8004` (notification).
