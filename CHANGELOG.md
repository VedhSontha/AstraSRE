# Changelog

All notable changes to the AstraSRE project will be documented in this file.

## [3.0.0] - 2026-07-02
### Added
- Upgraded dashboard architecture to **Next.js 14** featuring responsive page layouts, glowing status maps, and Framer Motion transitions.
- Integrated **Interactive Live Dependency SVG Graph** supporting service-level metric drilldowns.
- Added quick tracing links to **Jaeger UI**.

## [2.1.0] - 2026-06-15
### Added
- Automated **Discord Webhook Alerts** using system telemetry and `psutil` system metrics.
- Refactored orchestrator runtime state to a global dictionary to resolve REST endpoint synchronization bugs.

## [1.0.0] - 2026-05-10
### Added
- Initial prototype of the 5-service Flask distributed mesh.
- Vanilla HTML/JS control dashboard.
- Isolation Forest anomaly scoring and basic dependency tree parsing.
