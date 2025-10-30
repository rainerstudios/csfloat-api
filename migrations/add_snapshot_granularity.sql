-- ============================================================================
-- Portfolio Snapshots Enhancement
-- Add granularity field for time-series tracking
-- ============================================================================

-- Add granularity field to portfolio_snapshots table
ALTER TABLE portfolio_snapshots
ADD COLUMN IF NOT EXISTS granularity TEXT DEFAULT 'daily'
CHECK (granularity IN ('hourly', 'daily', 'monthly'));

-- Update unique constraint to include granularity
ALTER TABLE portfolio_snapshots
DROP CONSTRAINT IF EXISTS portfolio_snapshots_user_id_snapshot_date_key;

ALTER TABLE portfolio_snapshots
ADD CONSTRAINT portfolio_snapshots_user_date_granularity_key
UNIQUE (user_id, snapshot_date, granularity);

-- Add index for faster time-series queries
CREATE INDEX IF NOT EXISTS idx_snapshots_user_granularity
ON portfolio_snapshots(user_id, granularity, snapshot_date DESC);

-- Add partial sales support fields to portfolio_investments
ALTER TABLE portfolio_investments
ADD COLUMN IF NOT EXISTS original_quantity INTEGER;

-- Backfill original_quantity for existing records
UPDATE portfolio_investments
SET original_quantity = quantity
WHERE original_quantity IS NULL;

-- Add fields for price/marketplace overrides
ALTER TABLE portfolio_investments
ADD COLUMN IF NOT EXISTS price_override DECIMAL(10,2);

ALTER TABLE portfolio_investments
ADD COLUMN IF NOT EXISTS marketplace_override TEXT;

-- Update portfolio_sales to support partial sales better
ALTER TABLE portfolio_sales
ADD COLUMN IF NOT EXISTS remaining_quantity INTEGER;

-- Create user settings table for marketplace preferences
CREATE TABLE IF NOT EXISTS user_settings (
    id SERIAL PRIMARY KEY,
    user_id TEXT UNIQUE NOT NULL,
    marketplace_priority TEXT[] DEFAULT ARRAY['steam', 'csfloat', 'skinport', 'buff163'],
    timezone TEXT DEFAULT 'UTC',
    currency TEXT DEFAULT 'USD',
    auto_snapshot BOOLEAN DEFAULT true,
    snapshot_frequency TEXT DEFAULT 'daily' CHECK (snapshot_frequency IN ('hourly', 'daily', 'weekly')),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_settings_user ON user_settings(user_id);

-- Verification
SELECT 'Migration completed successfully!' as status;
SELECT COUNT(*) as snapshots_count FROM portfolio_snapshots;
SELECT COUNT(*) as investments_count FROM portfolio_investments;
