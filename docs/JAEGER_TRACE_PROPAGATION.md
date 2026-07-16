# Jaeger Span Context Propagation

Tracing requests across the distributed mesh:
- Span context is propagated using OpenTelemetry W3C Trace Context headers.
- Context injection handles trace IDs between order and payment HTTP gateways.
