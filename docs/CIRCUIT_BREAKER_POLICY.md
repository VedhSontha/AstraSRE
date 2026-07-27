# Circuit Breaker Policy & Configuration

State transitions for fault isolation in microservices:
- **CLOSED**: Normal operation. All requests pass through.
- **OPEN**: Error rate > 50% over 10s window. Fast-fail incoming requests.
- **HALF-OPEN**: Probe service health after 15s cooldown.
