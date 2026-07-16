# Chaos Logging Guide

Event schema for failure injections and heals in AstraSRE:
- Fields: `ts`, `type` (inject/heal), `service` targeted, `failure_type` (latency/db_timeout/crash), `ok` status.
- Log entries are maintained in an in-memory rolling list of max size 100.
