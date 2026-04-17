CREATE TABLE IF NOT EXISTS price_alerts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    symbol TEXT NOT NULL,
    above DOUBLE PRECISION,
    below DOUBLE PRECISION,
    triggered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT price_alerts_threshold_check CHECK (
        above IS NOT NULL
        OR below IS NOT NULL
    )
);

CREATE INDEX IF NOT EXISTS idx_price_alerts_user_active ON price_alerts (user_id, created_at DESC)
WHERE
    triggered_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_price_alerts_symbol_active ON price_alerts (symbol)
WHERE
    triggered_at IS NULL;