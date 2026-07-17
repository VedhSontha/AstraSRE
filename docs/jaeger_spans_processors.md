# OpenTelemetry Spans Batching Guide

Managing tracing overhead inside Flask services:
- Integrates `BatchSpanProcessor` to batch spans before exporting.
- Exporter runs asynchronously in separate threads.
- Restricts local transaction overhead from bottlenecking core API logic.
