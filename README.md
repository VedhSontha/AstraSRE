# 🛰️ AstraSRE — Autonomous Chaos Engineering & Self-Healing Platform

<div align="center">

[![Python](https://img.shields.io/badge/Python-3.9+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![Docker](https://img.shields.io/badge/Docker-Orchestration-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)
[![Kubernetes](https://img.shields.io/badge/Kubernetes-Manifests-326CE5?style=for-the-badge&logo=kubernetes&logoColor=white)](https://kubernetes.io/)
[![Prometheus](https://img.shields.io/badge/Prometheus-Telemetry-E6522C?style=for-the-badge&logo=prometheus&logoColor=white)](https://prometheus.io/)
[![Socket.io](https://img.shields.io/badge/Socket.io-WebSockets-010101?style=for-the-badge&logo=socketdotio&logoColor=white)](https://socket.io/)

> **An AI-powered SRE agent that predicts system failures, isolates root causes using multi-signal observability, automatically remediates issues, and generates natural language incident reports.**

</div>

---

## 🏗️ System Architecture

AstraSRE runs a distributed microservices architecture consisting of **5 custom Flask services**, fully instrumented with a modern cloud-native observability stack. An intelligent Orchestrator acts as the "SRE brain" to monitor, diagnose, and heal the system in real time.

```
                  ┌──────────────────────────────────────────────┐
                  │              Live Web Dashboard              │
                  │   (Interactive SVG Map + Chart.js Logs)      │
                  └──────────────┬──────────────────▲────────────┘
                                 │ HTTP             │ Socket.io
                                 ▼                  │
┌───────────────────────────────────────────────────┴────────────┐
│                    AstraSRE Orchestrator                       │
│    (Isolation Forest Anomaly Detection + RCA Graph Engine)     │
└────────┬───────────────────┬───────────────────┬───────────────┘
         │ Scrapes           │ Queries           │ Traces
         ▼                   ▼                   ▼
   ┌───────────┐       ┌───────────┐       ┌───────────┐
   │Prometheus │       │   Loki    │       │  Jaeger   │
   └─────▲─────┘       └─────▲─────┘       └─────▲─────┘
         │                   │                   │
         └─────────────┬─────┴───────────────────┘
                       │ (Telemetry Instrumentation)
                       │
 ┌─────────────────────▼────────────────────────────────────────┐
 │                   5 Distributed Microservices                 │
 │   frontend ──► order ──► inventory ──► payment ──► Postgres  │
 │                    │                                         │
 │                    └──► notification ──► Redis               │
 └──────────────────────────────────────────────────────────────┘
```

---

## ⚡ Core Capabilities

* **🤖 Anomaly Detection (Isolation Forest)**: Trains on normal telemetry patterns to monitor rolling windows of `[CPU%, Latency (ms), Error Rate%]`. Recognizes anomalies with >90% confidence, filtering transient noise from real outages.
* **🌳 Topological Root Cause Analysis**: Walks the service dependency graph using Breadth-First Search (BFS) to identify the true root-cause node (e.g., separating the database bottleneck from cascading upstream failures).
* **⚡ Autonomous Self-Healing**: Closed-loop control triggers immediate remediation policies—auto-restarting crashed pods, scaling replicas, or flushing cache pools—to recover system health in **under 5 seconds**.
* **📝 Generative LLM Incident Post-Mortems**: Integrates with local Ollama models or the Groq API to parse system state, trace pathways, and write complete, natural language incident reports instantly.
* **📊 Rich SRE Control Center**: Live SVG dependency graph and Chart.js metrics monitor the health of all services in real time, with interactive slider controls to inject database timeouts, latency spikes, or service crashes.

---

## 🚀 Quick Start (Docker Compose)

Get the full microservices stack, database, telemetry brokers, and dashboard running locally in minutes:

### 1. Clone & Set Up Configuration
```bash
cd hack_antig

# (Optional) Set up free LLM integration:
cp .env.example .env
# Edit .env and paste your Groq API Key: GROQ_API_KEY=gsk_...
```

### 2. Launch the Stack
```bash
docker-compose up --build -d
```
*Wait ~30 seconds for the databases and telemetry brokers to initialize.*

### 3. Open the Dashboards
* **SRE Control Panel**: Open [dashboard/index.html](file:///c:/Users/vedhr/CODES/hack_antig/dashboard/index.html) in your browser.
* **Distributed Tracing (Jaeger)**: [http://localhost:16686](http://localhost:16686)
* **Metrics Dashboard (Prometheus)**: [http://localhost:9090](http://localhost:9090)

---

## 🎮 Interactive Demo Walkthrough

Try the following scenario to see the autonomous SRE agent in action:

1. Open the **SRE Control Panel** (`dashboard/index.html`).
2. Under the **Chaos Injection** card, select **`payment`** and choose **`db_timeout`**. Click **Inject**.
3. Watch the cascade propagate: `payment` turns **RED**, and `order` and `frontend` turn **ORANGE** as response times spike.
4. Observe the **Live Metrics Chart** spike instantly.
5. Under the **Incident Log**, notice the AI flag a critical anomaly:
   ```
   [AI Alert] CRITICAL Anomaly detected in payment (Score: 91.2%)
   ```
6. The Orchestrator automatically decides on a remediation policy and executes it:
   ```
   [Recovery] Action executed: RESTART on service: payment
   [Recovery] System successfully recovered in 4.2 seconds!
   ```
7. A complete, LLM-generated incident report is populated containing log dumps, metrics, and mitigation steps.
8. Click **Reset System** or **Heal All** to clear states and return the map to a healthy green state.

---

## 📁 System Component Layout

```
hack_antig/
├── services/
│   ├── payment.py          # Port 5002 / metrics 8000 (Postgres connection)
│   ├── order.py            # Port 5001 / metrics 8001 (Core business logic)
│   ├── inventory.py        # Port 5003 / metrics 8002 (Redis cached stocks)
│   ├── frontend.py         # Port 5000 / metrics 8003 (Gateway service)
│   └── notification.py     # Port 5004 / metrics 8004 (Email/notification logs)
├── ai/
│   ├── isolation_forest.py # Isolation Forest machine learning detector
│   ├── metric_collector.py # Prometheus telemetry parser and vectorizer
│   ├── rca_engine.py       # Breadth-first graph traversal for root causes
│   └── llm_agent.py        # LLM interface (Groq / Ollama / templates)
├── chaos/
│   ├── chaos_controller.py # Injects synthetic errors via API mocks
│   └── action_engine.py    # Rule-engine decider for restarts / scaling
├── orchestrator.py         # The central SRE brain & Socket.io server
├── dashboard/
│   └── index.html          # Interactive HTML/JS Web Dashboard
├── k8s/                    # Production Kubernetes manifests
│   ├── infra.yaml          # Database and caching deployments
│   ├── services.yaml       # Internal ClusterIP service configurations
│   └── payment.yaml        # Individual payment app configuration
├── docker-compose.yml      # Orchestrates all local system containers
├── requirements.txt        # System requirements and dependencies
└── .env.example            # Environment configurations blueprint
```

---

## 🌐 Telemetry Port Map

| Component | Port | Purpose |
| :--- | :--- | :--- |
| **`frontend`** | `5000` | HTTP Gateway Gateway |
| **`order`** | `5001` | Order Handler app |
| **`payment`** | `5002` | Payment app |
| **`inventory`** | `5003` | Stock checker |
| **`notification`** | `5004` | Async alerts service |
| **`orchestrator`** | `5010` | SRE Controller Brain |
| **`prometheus`** | `9090` | Metrics Database |
| **`loki`** | `3100` | Log Collector |
| **`jaeger`** | `16686` | Distributed Tracing UI |

---

## 🤖 Generative AI Configurations

### Option A: Cloud Execution (Groq API — Default)
1. Sign up for a free key at [console.groq.com](https://console.groq.com).
2. Save to `.env`: `GROQ_API_KEY=gsk_...`
3. Uses high-performance `llama-3.3-70b-versatile` with zero cost or system overhead.

### Option B: Local Execution (Ollama)
1. Install [Ollama](https://ollama.ai).
2. Pull the model: `ollama pull llama3.2:3b`.
3. Start Ollama locally. The Orchestrator automatically detects the local instance and shifts load to it.

---

## 🏆 Hackathon / Production Feature Grid

- [x] **5-Service Distributed Mesh** with real HTTP communication.
- [x] **Cascading Failure Simulation** showing multi-tier degradation.
- [x] **3 Chaos Injection Modes** (Network Latency, DB connection timeout, App crash).
- [x] **Machine Learning Isolation Forest** for adaptive anomaly categorization.
- [x] **BFS Dependency Graph Traversal** for fast root-cause identification.
- [x] **Closed-loop SRE Control Loop** bridging detection, root-cause, and remediation.
- [x] **Automated Recovery Playbooks** (App restart, scale-out replicas, pool flushes).
- [x] **WebSocket Event Broadcasting** via Flask-SocketIO.
- [x] **Prometheus, Loki, and Jaeger** instrumentation for unified telemetry.
- [x] **Production Kubernetes Manifests** including deployments, services, and volumes.
