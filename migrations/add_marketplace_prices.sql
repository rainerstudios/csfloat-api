-- ============================================================================
-- Marketplace Prices Table
-- Multi-marketplace price tracking from CSGOTrader API
-- ============================================================================

-- Create marketplace prices table
CREATE TABLE IF NOT EXISTS marketplace_prices (
    id SERIAL PRIMARY KEY,
    item_name TEXT NOT NULL,
    marketplace TEXT NOT NULL,
    price DECIMAL(10,2),
    starting_at JSONB,
    highest_order JSONB,
    last_24h DECIMAL(10,2),
    last_7d DECIMAL(10,2),
    last_30d DECIMAL(10,2),
    last_90d DECIMAL(10,2),
    run_id TEXT,
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(item_name, marketplace)
);

CREATE INDEX IF NOT EXISTS idx_marketplace_prices_item ON marketplace_prices(item_name);
CREATE INDEX IF NOT EXISTS idx_marketplace_prices_marketplace ON marketplace_prices(marketplace);
CREATE INDEX IF NOT EXISTS idx_marketplace_prices_updated ON marketplace_prices(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketplace_prices_run ON marketplace_prices(run_id);

-- Verification
SELECT 'Marketplace prices table created successfully!' as status;
