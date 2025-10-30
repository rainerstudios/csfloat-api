/**
 * Authentication Library
 * API key based authentication for CSFloat Investment Tracker API
 */

const crypto = require('crypto');

/**
 * Generate a new API key
 * Format: csfloat_{64_hex_chars}
 */
function generateApiKey() {
    const randomBytes = crypto.randomBytes(32);
    return `csfloat_${randomBytes.toString('hex')}`;
}

/**
 * Hash API key for secure storage (not currently used, but available)
 */
function hashApiKey(apiKey) {
    return crypto.createHash('sha256').update(apiKey).digest('hex');
}

/**
 * Authentication middleware
 * Checks for valid API key in header or query parameter
 */
function authMiddleware(postgres) {
    return async (req, res, next) => {
        // Get API key from header or query
        const apiKey = req.headers['x-api-key'] ||
                       req.headers['authorization']?.replace('Bearer ', '') ||
                       req.query.api_key;

        if (!apiKey) {
            return res.status(401).json({
                error: 'Missing API key',
                message: 'Provide API key via X-API-Key header or ?api_key= parameter',
                code: 'AUTH_MISSING_KEY'
            });
        }

        try {
            // Validate API key
            const result = await postgres.query(`
                SELECT id, user_id, permissions, rate_limit, is_active, expires_at
                FROM api_keys
                WHERE api_key = $1
            `, [apiKey]);

            if (result.rows.length === 0) {
                return res.status(401).json({
                    error: 'Invalid API key',
                    message: 'API key not found',
                    code: 'AUTH_INVALID_KEY'
                });
            }

            const keyData = result.rows[0];

            // Check if key is active
            if (!keyData.is_active) {
                return res.status(401).json({
                    error: 'API key disabled',
                    message: 'This API key has been disabled',
                    code: 'AUTH_KEY_DISABLED'
                });
            }

            // Check if key is expired
            if (keyData.expires_at && new Date(keyData.expires_at) < new Date()) {
                return res.status(401).json({
                    error: 'API key expired',
                    message: 'This API key has expired',
                    code: 'AUTH_KEY_EXPIRED'
                });
            }

            // Update last used timestamp
            await postgres.query(`
                UPDATE api_keys
                SET last_used_at = NOW()
                WHERE id = $1
            `, [keyData.id]);

            // Attach user info to request
            req.apiKeyId = keyData.id;
            req.userId = keyData.user_id;
            req.permissions = keyData.permissions;

            next();
        } catch (error) {
            console.error('Auth middleware error:', error);
            return res.status(500).json({
                error: 'Authentication error',
                message: error.message,
                code: 'AUTH_ERROR'
            });
        }
    };
}

/**
 * Permission check middleware
 * Verifies user has required permission
 */
function requirePermission(permission) {
    return (req, res, next) => {
        if (!req.permissions || !req.permissions.includes(permission)) {
            return res.status(403).json({
                error: 'Insufficient permissions',
                message: `This endpoint requires '${permission}' permission`,
                code: 'AUTH_FORBIDDEN',
                required_permission: permission,
                your_permissions: req.permissions || []
            });
        }
        next();
    };
}

/**
 * Optional auth middleware
 * Allows requests with or without API key, but validates if present
 */
function optionalAuth(postgres) {
    return async (req, res, next) => {
        const apiKey = req.headers['x-api-key'] ||
                       req.headers['authorization']?.replace('Bearer ', '') ||
                       req.query.api_key;

        if (!apiKey) {
            // No API key provided, continue without auth
            return next();
        }

        try {
            const result = await postgres.query(`
                SELECT id, user_id, permissions, is_active, expires_at
                FROM api_keys
                WHERE api_key = $1 AND is_active = true
            `, [apiKey]);

            if (result.rows.length > 0) {
                const keyData = result.rows[0];

                if (!keyData.expires_at || new Date(keyData.expires_at) > new Date()) {
                    req.apiKeyId = keyData.id;
                    req.userId = keyData.user_id;
                    req.permissions = keyData.permissions;

                    await postgres.query(
                        'UPDATE api_keys SET last_used_at = NOW() WHERE id = $1',
                        [keyData.id]
                    );
                }
            }
        } catch (error) {
            console.error('Optional auth error:', error);
        }

        next();
    };
}

/**
 * Log API usage
 */
async function logApiUsage(postgres, apiKeyId, userId, endpoint, method, statusCode, responseTime, ip, userAgent) {
    try {
        await postgres.query(`
            INSERT INTO api_usage_logs (
                api_key_id, user_id, endpoint, method,
                status_code, response_time_ms, ip_address, user_agent
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [apiKeyId, userId, endpoint, method, statusCode, responseTime, ip, userAgent]);
    } catch (error) {
        console.error('Failed to log API usage:', error);
    }
}

/**
 * Rate limiting check
 */
async function checkRateLimit(postgres, apiKeyId, limit = 1000, window = 3600000) {
    const result = await postgres.query(`
        SELECT COUNT(*) as count
        FROM api_usage_logs
        WHERE api_key_id = $1
        AND created_at > NOW() - INTERVAL '1 hour'
    `, [apiKeyId]);

    const count = parseInt(result.rows[0].count);
    return {
        allowed: count < limit,
        remaining: Math.max(0, limit - count),
        limit,
        reset: new Date(Date.now() + window)
    };
}

module.exports = {
    generateApiKey,
    hashApiKey,
    authMiddleware,
    requirePermission,
    optionalAuth,
    logApiUsage,
    checkRateLimit
};
