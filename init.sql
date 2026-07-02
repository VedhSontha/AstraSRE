-- AstraSRE PostgreSQL Schema
-- Auto-executed on first postgres container start

CREATE TABLE IF NOT EXISTS orders (
    id          SERIAL PRIMARY KEY,
    status      VARCHAR(20) NOT NULL DEFAULT 'pending',
    total_amount INTEGER,
    created_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payments (
    id          SERIAL PRIMARY KEY,
    order_id    INTEGER REFERENCES orders(id) ON DELETE SET NULL,
    amount      INTEGER NOT NULL,
    status      VARCHAR(20) NOT NULL DEFAULT 'pending',
    latency_ms  INTEGER,
    created_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS incident_log (
    id          SERIAL PRIMARY KEY,
    service     VARCHAR(50),
    severity    VARCHAR(20),
    action_taken VARCHAR(50),
    recovery_time_s FLOAT,
    recovered   BOOLEAN,
    ts          TIMESTAMP DEFAULT NOW()
);

-- Seed some initial orders
INSERT INTO orders (status, total_amount) VALUES
  ('completed', 250),
  ('completed', 89),
  ('completed', 430)
ON CONFLICT DO NOTHING;
