# SRE Architectural Decisions

Key design choices behind the AstraSRE automated platform:
- **Decision 1**: Isolation Forest selected over threshold checks for multi-signal correlation.
- **Decision 2**: Socket.io chosen over HTTP polling to enable live real-time graph updates.
- **Decision 3**: Container restarts prioritize state healing for rapid MTTR.
