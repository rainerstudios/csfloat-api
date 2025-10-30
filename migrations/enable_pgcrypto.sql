-- Enable pgcrypto extension for API key generation
-- Required for gen_random_bytes() function used in generate_user_api_key()

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Test that the function works
SELECT generate_user_api_key();
