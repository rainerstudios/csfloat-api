-- Price Change Tracking Table
-- Tracks historical price changes for items in user portfolios

CREATE TABLE IF NOT EXISTS price_changes (
    id SERIAL PRIMARY KEY,
    item_name TEXT NOT NULL,
    old_price NUMERIC(10, 2) NOT NULL,
    new_price NUMERIC(10, 2) NOT NULL,
    price_change NUMERIC(10, 2) NOT NULL,
    percent_change NUMERIC(5, 2) NOT NULL,
    marketplace VARCHAR(50) DEFAULT 'buff163',
    detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes separately
CREATE INDEX IF NOT EXISTS idx_price_changes_item ON price_changes(item_name);
CREATE INDEX IF NOT EXISTS idx_price_changes_date ON price_changes(detected_at DESC);

-- User Price Alerts Table
-- Allows users to set alerts for specific items or portfolio-wide

CREATE TABLE IF NOT EXISTS price_alerts (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    user_steam_id VARCHAR(255) NOT NULL,
    item_name TEXT,  -- NULL means alert on ALL portfolio items
    alert_type VARCHAR(50) NOT NULL,  -- 'price_drop', 'price_spike', 'threshold'
    threshold NUMERIC(5, 2),  -- Percentage or absolute value
    notification_method VARCHAR(50) DEFAULT 'in_app',  -- 'in_app', 'email', 'discord', 'webhook'
    webhook_url TEXT,
    is_active BOOLEAN DEFAULT true,
    last_triggered TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes separately
CREATE INDEX IF NOT EXISTS idx_alerts_user ON price_alerts(user_steam_id);
CREATE INDEX IF NOT EXISTS idx_alerts_active ON price_alerts(is_active);
CREATE INDEX IF NOT EXISTS idx_alerts_item ON price_alerts(item_name);

-- User Notifications Table
-- Stores price change notifications for users

CREATE TABLE IF NOT EXISTS user_notifications (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    user_steam_id VARCHAR(255) NOT NULL,
    notification_type VARCHAR(50) NOT NULL,  -- 'price_change', 'milestone', 'alert'
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    data JSONB,  -- Additional data (item details, prices, etc.)
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes separately
CREATE INDEX IF NOT EXISTS idx_notifications_user ON user_notifications(user_steam_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON user_notifications(user_steam_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_date ON user_notifications(created_at DESC);

-- Recent Price Changes View
-- Shows items with significant price changes in the last 24 hours

CREATE OR REPLACE VIEW recent_price_changes AS
SELECT
    item_name,
    old_price,
    new_price,
    price_change,
    percent_change,
    marketplace,
    detected_at,
    CASE
        WHEN percent_change >= 10 THEN 'major_increase'
        WHEN percent_change >= 5 THEN 'increase'
        WHEN percent_change <= -10 THEN 'major_decrease'
        WHEN percent_change <= -5 THEN 'decrease'
        ELSE 'stable'
    END as change_category
FROM price_changes
WHERE detected_at >= NOW() - INTERVAL '24 hours'
ORDER BY ABS(percent_change) DESC;

-- Comments for documentation
COMMENT ON TABLE price_changes IS 'Tracks historical price changes for all items';
COMMENT ON TABLE price_alerts IS 'User-configured price alerts and notifications';
COMMENT ON TABLE user_notifications IS 'In-app notifications for users';
COMMENT ON VIEW recent_price_changes IS 'Items with significant price changes in last 24 hours';
