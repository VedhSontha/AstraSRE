# Jaeger Distributed Tracing Console

How to query trace spans for payment/order bottleneck diagnosis:
- Open Jaeger UI locally on port `16686`.
- Query spans targeting custom tag parameters: `db.payment_id` or `error=true`.
- Trace flows evaluate inter-service cascading delays.
