FROM python:3.11-slim

WORKDIR /app

# Install Docker CLI so the orchestrator can execute real container restarts
RUN apt-get update && apt-get install -y curl \
    && curl -fsSL https://download.docker.com/linux/static/stable/x86_64/docker-27.3.1.tgz \
       | tar -xzC /usr/local/bin --strip-components=1 docker/docker \
    && rm -rf /var/lib/apt/lists/*

# Install deps first (layer cache)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy all source
COPY . .

# Default — overridden by docker-compose command:
CMD ["python", "orchestrator.py"]
