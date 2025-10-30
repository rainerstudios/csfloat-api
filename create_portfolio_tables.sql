-- ============================================================================
-- CS2 Float Checker - Portfolio Tracking Database Schema
-- Created: 2025-10-30
-- Purpose: Investment tracking, portfolio analytics, investment scoring
-- ============================================================================

-- User portfolio investments table
CREATE TABLE IF NOT EXISTS portfolio_investments (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    item_name TEXT NOT NULL,

    -- Purchase details
    purchase_price DECIMAL(10,2) NOT NULL,
    purchase_date TIMESTAMP DEFAULT NOW(),
    quantity INTEGER DEFAULT 1,
    marketplace TEXT, -- 'Steam', 'Buff163', 'CSFloat', 'Skinport', etc.

    -- Float data (from existing items table)
    float_value DECIMAL(10,8),
    pattern_index INTEGER,
    defindex INTEGER,
    paintindex INTEGER,
    wear TEXT, -- 'FN', 'MW', 'FT', 'WW', 'BS'
    is_stattrak BOOLEAN DEFAULT false,

    -- Investment analysis (NEW)
    investment_score DECIMAL(3,1), -- 1.0-10.0
    investment_score_breakdown JSONB,
    float_rarity_score INTEGER, -- 0-100
    pattern_tier TEXT, -- 'Tier 1', 'Tier 2', 'Tier 3', 'Standard'
    pattern_value_multiplier DECIMAL(5,2),

    -- Stickers (if applicable)
    stickers JSONB,
    sticker_total_value DECIMAL(10,2),

    -- Metadata
    notes TEXT,
    tags TEXT[], -- ['blue-gem', 'long-term', 'arbitrage', 'fade', 'doppler']
    is_sold BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_portfolio_user ON portfolio_investments(user_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_item ON portfolio_investments(item_name);
CREATE INDEX IF NOT EXISTS idx_portfolio_score ON portfolio_investments(investment_score DESC);
CREATE INDEX IF NOT EXISTS idx_portfolio_created ON portfolio_investments(created_at DESC);

-- Sales records table
CREATE TABLE IF NOT EXISTS portfolio_sales (
    id SERIAL PRIMARY KEY,
    investment_id INTEGER REFERENCES portfolio_investments(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,

    quantity INTEGER NOT NULL,
    sale_price DECIMAL(10,2) NOT NULL,
    sale_date TIMESTAMP DEFAULT NOW(),
    marketplace TEXT,

    -- Calculated fields
    profit_loss DECIMAL(10,2), -- (sale_price - purchase_price) * quantity
    roi_percent DECIMAL(5,2),

    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_investment ON portfolio_sales(investment_id);
CREATE INDEX IF NOT EXISTS idx_sales_user ON portfolio_sales(user_id);
CREATE INDEX IF NOT EXISTS idx_sales_date ON portfolio_sales(sale_date DESC);

-- Daily portfolio snapshots table
CREATE TABLE IF NOT EXISTS portfolio_snapshots (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    snapshot_date DATE DEFAULT CURRENT_DATE,

    total_value DECIMAL(10,2),
    total_invested DECIMAL(10,2),
    realized_profit DECIMAL(10,2),
    unrealized_profit DECIMAL(10,2),
    total_roi DECIMAL(5,2),
    item_count INTEGER,

    -- Asset allocation breakdown
    asset_allocation JSONB, -- {knives: 5000, rifles: 3000, pistols: 1500, gloves: 2000}

    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_snapshots_user ON portfolio_snapshots(user_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_date ON portfolio_snapshots(snapshot_date DESC);

-- Investment score cache table (pre-calculated scores)
CREATE TABLE IF NOT EXISTS investment_scores_cache (
    id SERIAL PRIMARY KEY,
    item_name TEXT NOT NULL,
    float_value DECIMAL(10,8),
    pattern_index INTEGER,

    -- Scores (1-10 scale)
    overall_score DECIMAL(3,1),
    float_rarity_score DECIMAL(3,1),
    pattern_value_score DECIMAL(3,1),
    liquidity_score DECIMAL(3,1),
    price_trend_score DECIMAL(3,1),
    weapon_popularity_score DECIMAL(3,1),
    volatility_score DECIMAL(3,1),

    score_breakdown JSONB,
    recommendation TEXT,
    calculated_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(item_name, float_value, pattern_index)
);

CREATE INDEX IF NOT EXISTS idx_scores_item ON investment_scores_cache(item_name);
CREATE INDEX IF NOT EXISTS idx_scores_overall ON investment_scores_cache(overall_score DESC);
CREATE INDEX IF NOT EXISTS idx_scores_calculated ON investment_scores_cache(calculated_at DESC);

-- CSGO-API item database (synced from ByMykel/CSGO-API)
CREATE TABLE IF NOT EXISTS game_items (
    id SERIAL PRIMARY KEY,
    item_name TEXT UNIQUE NOT NULL,
    weapon_type TEXT, -- 'knife', 'rifle', 'pistol', 'glove', 'sticker', 'case', 'agent'
    rarity TEXT, -- 'Covert', 'Classified', 'Restricted', 'Mil-Spec', 'Industrial Grade'
    collection TEXT,
    case_name TEXT,
    min_float DECIMAL(10,8),
    max_float DECIMAL(10,8),
    has_stattrak BOOLEAN DEFAULT false,
    weapon_popularity_tier TEXT, -- 'S', 'A', 'B', 'C'
    image_url TEXT,
    synced_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_game_items_name ON game_items(item_name);
CREATE INDEX IF NOT EXISTS idx_game_items_type ON game_items(weapon_type);
CREATE INDEX IF NOT EXISTS idx_game_items_rarity ON game_items(rarity);
CREATE INDEX IF NOT EXISTS idx_game_items_popularity ON game_items(weapon_popularity_tier);

-- Blue Gem patterns reference table
CREATE TABLE IF NOT EXISTS blue_gem_patterns (
    id SERIAL PRIMARY KEY,
    weapon_type TEXT NOT NULL, -- 'AK-47', 'Five-SeveN', 'Karambit', etc.
    pattern_index INTEGER NOT NULL,
    tier TEXT NOT NULL, -- 'Tier 1', 'Tier 2', 'Tier 3'
    blue_percentage DECIMAL(5,2), -- Estimated blue % on playside
    value_multiplier DECIMAL(6,2), -- How much more valuable (e.g., 125.0 = 125x)
    description TEXT,
    UNIQUE(weapon_type, pattern_index)
);

CREATE INDEX IF NOT EXISTS idx_blue_gems_weapon ON blue_gem_patterns(weapon_type);
CREATE INDEX IF NOT EXISTS idx_blue_gems_tier ON blue_gem_patterns(tier);

-- Insert Blue Gem reference data (AK-47)
INSERT INTO blue_gem_patterns (weapon_type, pattern_index, tier, blue_percentage, value_multiplier, description) VALUES
-- Tier 1 (Legendary)
('AK-47', 661, 'Tier 1', 92.0, 125.0, 'The #1 most sought-after AK-47 Blue Gem. Sold for $1,000,000 in FN condition (June 2024).'),
('AK-47', 387, 'Tier 1', 90.0, 100.0, 'Legendary full blue top pattern. Extremely rare and valuable.'),
('AK-47', 670, 'Tier 1', 88.0, 95.0, 'Near-perfect blue coverage. Top tier investment.'),
('AK-47', 321, 'Tier 1', 87.0, 90.0, 'Full blue mag and top. One of the "Big 4" patterns.'),

-- Tier 2 (High-tier)
('AK-47', 151, 'Tier 2', 75.0, 15.0, 'Clean blue top with minimal purple. Highly desirable.'),
('AK-47', 179, 'Tier 2', 73.0, 14.0, 'Solid blue pattern with good coverage.'),
('AK-47', 470, 'Tier 2', 72.0, 13.0, 'Consistent blue across playside.'),
('AK-47', 555, 'Tier 2', 70.0, 12.0, 'Clean blue pattern, popular among collectors.'),

-- Tier 3 (Mid-tier Blue Gems)
('AK-47', 103, 'Tier 3', 60.0, 5.0, 'Good blue coverage, solid investment.'),
('AK-47', 147, 'Tier 3', 58.0, 4.8, 'Noticeable blue pattern.'),
('AK-47', 168, 'Tier 3', 57.0, 4.5, 'Mid-tier blue gem with good value.'),
('AK-47', 592, 'Tier 3', 55.0, 4.2, 'Decent blue coverage.'),
('AK-47', 828, 'Tier 3', 54.0, 4.0, 'Entry-level blue gem.'),
('AK-47', 868, 'Tier 3', 52.0, 3.8, 'Affordable blue gem option.')

ON CONFLICT (weapon_type, pattern_index) DO NOTHING;

-- Weapon popularity reference data
INSERT INTO game_items (item_name, weapon_type, weapon_popularity_tier) VALUES
-- S-Tier (Most popular, safest investments)
('Karambit', 'knife', 'S'),
('Butterfly Knife', 'knife', 'S'),
('M9 Bayonet', 'knife', 'S'),
('Bayonet', 'knife', 'S'),
('AK-47', 'rifle', 'S'),
('M4A4', 'rifle', 'S'),
('M4A1-S', 'rifle', 'S'),
('AWP', 'sniper', 'S'),
('Sport Gloves', 'gloves', 'S'),
('Specialist Gloves', 'gloves', 'S'),

-- A-Tier (Very popular)
('Desert Eagle', 'pistol', 'A'),
('USP-S', 'pistol', 'A'),
('Glock-18', 'pistol', 'A'),
('P250', 'pistol', 'A'),

-- B-Tier (Moderate popularity)
('Galil AR', 'rifle', 'B'),
('FAMAS', 'rifle', 'B'),
('Five-SeveN', 'pistol', 'B'),
('CZ75-Auto', 'pistol', 'B'),

-- C-Tier (Lower popularity)
('MAC-10', 'smg', 'C'),
('MP9', 'smg', 'C'),
('UMP-45', 'smg', 'C'),
('Nova', 'shotgun', 'C')

ON CONFLICT (item_name) DO UPDATE
SET weapon_popularity_tier = EXCLUDED.weapon_popularity_tier;

-- Grant permissions (if using specific user)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO cs2user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO cs2user;

-- Create view for easy portfolio analytics
CREATE OR REPLACE VIEW portfolio_summary AS
SELECT
    pi.user_id,
    COUNT(pi.id) as total_items,
    SUM(pi.purchase_price * pi.quantity) as total_invested,
    SUM(COALESCE(ps.quantity, 0)) as total_sold,
    SUM(COALESCE(ps.profit_loss, 0)) as realized_profit,
    AVG(pi.investment_score) as avg_investment_score,
    COUNT(CASE WHEN pi.pattern_tier IN ('Tier 1', 'Tier 2') THEN 1 END) as blue_gems_count
FROM portfolio_investments pi
LEFT JOIN portfolio_sales ps ON pi.id = ps.investment_id
WHERE pi.is_sold = false
GROUP BY pi.user_id;

-- Verification queries
SELECT 'Portfolio tables created successfully!' as status;
SELECT COUNT(*) as investment_count FROM portfolio_investments;
SELECT COUNT(*) as sales_count FROM portfolio_sales;
SELECT COUNT(*) as snapshots_count FROM portfolio_snapshots;
SELECT COUNT(*) as game_items_count FROM game_items;
SELECT COUNT(*) as blue_gems_count FROM blue_gem_patterns;

-- Show table sizes
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('portfolio_investments', 'portfolio_sales', 'portfolio_snapshots',
                    'investment_scores_cache', 'game_items', 'blue_gem_patterns')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
