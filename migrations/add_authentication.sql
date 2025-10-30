-- ============================================================================
-- Authentication System
-- API key based authentication for backend API access
-- ============================================================================

-- Create API keys table
CREATE TABLE IF NOT EXISTS api_keys (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    api_key TEXT UNIQUE NOT NULL,
    key_name TEXT,
    permissions TEXT[] DEFAULT ARRAY['read', 'write'],
    rate_limit INTEGER DEFAULT 1000,
    is_active BOOLEAN DEFAULT true,
    last_used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP,
    CONSTRAINT unique_user_key_name UNIQUE (user_id, key_name)
);

CREATE INDEX IF NOT EXISTS idx_api_keys_key ON api_keys(api_key) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);

-- Create API usage logs table
CREATE TABLE IF NOT EXISTS api_usage_logs (
    id SERIAL PRIMARY KEY,
    api_key_id INTEGER REFERENCES api_keys(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    method TEXT NOT NULL,
    status_code INTEGER,
    response_time_ms INTEGER,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usage_logs_key ON api_usage_logs(api_key_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_logs_user ON api_usage_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_logs_date ON api_usage_logs(created_at DESC);

-- Create Discord webhooks table
CREATE TABLE IF NOT EXISTS discord_webhooks (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    webhook_url TEXT NOT NULL,
    webhook_name TEXT,
    enabled BOOLEAN DEFAULT true,
    alert_types TEXT[] DEFAULT ARRAY['price_alert', 'portfolio_milestone', 'snapshot_created'],
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhooks_user ON discord_webhooks(user_id) WHERE enabled = true;

-- Create price alerts table
CREATE TABLE IF NOT EXISTS price_alerts (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    item_name TEXT NOT NULL,
    target_price DECIMAL(10,2) NOT NULL,
    condition TEXT CHECK (condition IN ('above', 'below')),
    marketplace TEXT,
    is_active BOOLEAN DEFAULT true,
    triggered_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_price_alerts_active ON price_alerts(is_active, item_name) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_price_alerts_user ON price_alerts(user_id);

-- Create price history tracking table for changes
CREATE TABLE IF NOT EXISTS price_change_tracking (
    id SERIAL PRIMARY KEY,
    item_name TEXT NOT NULL,
    marketplace TEXT NOT NULL,
    old_price DECIMAL(10,2),
    new_price DECIMAL(10,2),
    change_percent DECIMAL(5,2),
    tracked_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_price_changes_item ON price_change_tracking(item_name, tracked_at DESC);
CREATE INDEX IF NOT EXISTS idx_price_changes_date ON price_change_tracking(tracked_at DESC);

-- Function to generate API key
CREATE OR REPLACE FUNCTION generate_api_key()
RETURNS TEXT AS $$
DECLARE
    key TEXT;
BEGIN
    key := 'csfloat_' || encode(gen_random_bytes(32), 'hex');
    RETURN key;
END;
$$ LANGUAGE plpgsql;

-- Verification
SELECT 'Authentication migration completed successfully!' as status;
SELECT COUNT(*) as api_keys_count FROM api_keys;
SELECT COUNT(*) as webhooks_count FROM discord_webhooks;
SELECT COUNT(*) as alerts_count FROM price_alerts;
