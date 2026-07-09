# AstraSRE Jaeger Tracing Guide

Distributed tracing configuration:
- Exporter: OpenTelemetry OTLPSpanExporter pointing to `http://jaeger:4318/v1/traces`.
- Span processors gather metrics asynchronously using `BatchSpanProcessor`.
