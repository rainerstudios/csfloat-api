-- Create users table for Steam authentication
-- Migration Date: 2025-10-30
-- This table stores authenticated Steam users

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    steam_id VARCHAR(20) UNIQUE NOT NULL,
    steam_username VARCHAR(255),
    steam_avatar TEXT,
    steam_profile_url TEXT,
    api_key VARCHAR(255) UNIQUE, -- Auto-generated API key for programmatic access
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_steam_id ON users(steam_id);
CREATE INDEX IF NOT EXISTS idx_users_api_key ON users(api_key);

-- Link portfolio investments to users by steam_id
ALTER TABLE portfolio_investments
ADD COLUMN IF NOT EXISTS user_steam_id VARCHAR(20) REFERENCES users(steam_id);

-- Create index on user_steam_id for faster portfolio lookups
CREATE INDEX IF NOT EXISTS idx_investments_user_steam_id ON portfolio_investments(user_steam_id);

-- Function to auto-generate API key for users
CREATE OR REPLACE FUNCTION generate_user_api_key() RETURNS TEXT AS $$
BEGIN
    RETURN 'cs2float_' || encode(gen_random_bytes(32), 'hex');
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE users IS 'Stores authenticated Steam users';
COMMENT ON COLUMN users.steam_id IS 'Steam ID64 format';
COMMENT ON COLUMN users.api_key IS 'Auto-generated API key for backend calls';
