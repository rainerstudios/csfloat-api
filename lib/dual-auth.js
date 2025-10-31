/**
 * Dual Authentication Middleware
 * Supports both Passport.js sessions (legacy) and Better Auth JWT tokens (new)
 * Works with both legacy "users" table and Better Auth "user" table
 */

const jwt = require('jsonwebtoken');

// Use BETTER_AUTH_SECRET if available, fallback to JWT_SECRET
const JWT_SECRET = process.env.BETTER_AUTH_SECRET || process.env.JWT_SECRET || 'cs2float-secret-key-change-in-production';

// PostgreSQL connection will be injected
let postgres = null;

/**
 * Initialize the dual auth middleware with database connection
 */
function initialize(postgresConnection) {
    postgres = postgresConnection;
}

/**
 * Extract Steam ID from Better Auth account
 */
async function getSteamIdFromBetterAuth(userId) {
    if (!postgres) {
        throw new Error('PostgreSQL connection not initialized');
    }

    try {
        const result = await postgres.pool.query(`
            SELECT "accountId"
            FROM "account"
            WHERE "userId" = $1 AND "providerId" = 'steam'
            LIMIT 1
        `, [userId]);

        if (result.rows.length > 0) {
            return result.rows[0].accountId;
        }
        return null;
    } catch (error) {
        console.error('Error fetching Steam ID from Better Auth:', error);
        return null;
    }
}

/**
 * Sync Better Auth user to legacy users table
 * This ensures portfolio and other features work with existing schema
 */
async function syncUserToLegacy(betterAuthUser, steamId) {
    if (!postgres || !steamId) {
        return null;
    }

    try {
        // Check if user exists in legacy table
        const existingUser = await postgres.pool.query(
            'SELECT * FROM users WHERE steam_id = $1',
            [steamId]
        );

        if (existingUser.rows.length > 0) {
            // Update existing user
            const result = await postgres.pool.query(`
                UPDATE users
                SET steam_username = $1,
                    steam_avatar = $2,
                    last_login = CURRENT_TIMESTAMP
                WHERE steam_id = $3
                RETURNING *
            `, [betterAuthUser.name, betterAuthUser.image, steamId]);

            return result.rows[0];
        } else {
            // Create new user in legacy table
            // Generate API key for new user
            const apiKeyResult = await postgres.pool.query(`SELECT generate_user_api_key() as api_key`);
            const apiKey = apiKeyResult.rows[0].api_key;

            const result = await postgres.pool.query(`
                INSERT INTO users (steam_id, steam_username, steam_avatar, api_key, last_login)
                VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
                RETURNING *
            `, [steamId, betterAuthUser.name, betterAuthUser.image, apiKey]);

            return result.rows[0];
        }
    } catch (error) {
        console.error('Error syncing user to legacy table:', error);
        return null;
    }
}

/**
 * Verify Better Auth session token and get user data
 */
async function verifyBetterAuthSession(token) {
    if (!postgres) {
        throw new Error('PostgreSQL connection not initialized');
    }

    try {
        // Query Better Auth session table
        const sessionResult = await postgres.pool.query(`
            SELECT s.*, u."id" as user_id, u."name", u."email", u."image"
            FROM "session" s
            JOIN "user" u ON s."userId" = u."id"
            WHERE s."token" = $1 AND s."expiresAt" > NOW()
        `, [token]);

        if (sessionResult.rows.length === 0) {
            return null;
        }

        const session = sessionResult.rows[0];

        // Get Steam ID from account table
        const steamId = await getSteamIdFromBetterAuth(session.user_id);

        if (!steamId) {
            console.error('No Steam ID found for Better Auth user:', session.user_id);
            return null;
        }

        // Sync to legacy users table
        const legacyUser = await syncUserToLegacy({
            name: session.name,
            image: session.image,
            email: session.email
        }, steamId);

        return {
            steam_id: steamId,
            steam_username: session.name,
            steam_avatar: session.image,
            id: legacyUser?.id,
            api_key: legacyUser?.api_key,
            betterAuthUserId: session.user_id,
            email: session.email
        };
    } catch (error) {
        console.error('Error verifying Better Auth session:', error);
        return null;
    }
}

/**
 * Middleware to accept both Passport.js sessions and Better Auth tokens
 * This is the recommended middleware for all protected endpoints during migration
 */
function dualAuth(req, res, next) {
    // First, check if user is authenticated via Passport.js session
    if (req.isAuthenticated && req.isAuthenticated()) {
        // User authenticated via Passport.js session
        return next();
    }

    // Check for Better Auth session token in multiple locations
    const token = req.headers.authorization?.replace('Bearer ', '') ||
                  req.headers['x-auth-token'] ||
                  req.query.token ||
                  req.cookies?.token ||
                  req.cookies?.['better-auth.session_token'];

    if (!token) {
        return res.status(401).json({
            success: false,
            error: 'Authentication required',
            message: 'No authentication token provided'
        });
    }

    // Try JWT verification first (for old-style JWT tokens)
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = {
            steam_id: decoded.steam_id || decoded.steamId || decoded.id,
            steam_username: decoded.username || decoded.name || decoded.displayName,
            steam_avatar: decoded.avatar || decoded.image,
            steam_profile_url: decoded.profile_url || decoded.profileUrl,
            id: decoded.userId || decoded.id,
            ...decoded
        };
        return next();
    } catch (error) {
        // JWT verification failed, try Better Auth session
        verifyBetterAuthSession(token)
            .then(user => {
                if (user) {
                    req.user = user;
                    return next();
                } else {
                    return res.status(401).json({
                        success: false,
                        error: 'Invalid token',
                        message: 'Authentication token is invalid or expired'
                    });
                }
            })
            .catch(error => {
                console.error('Authentication error:', error);
                return res.status(401).json({
                    success: false,
                    error: 'Authentication failed',
                    message: 'Failed to verify authentication token'
                });
            });
    }
}

/**
 * Optional authentication - doesn't fail if no token
 * Useful for endpoints that want to know if user is logged in but don't require it
 */
function optionalAuth(req, res, next) {
    // Check Passport.js session first
    if (req.isAuthenticated && req.isAuthenticated()) {
        return next();
    }

    // Check for Better Auth token
    const token = req.headers.authorization?.replace('Bearer ', '') ||
                  req.headers['x-auth-token'] ||
                  req.query.token ||
                  req.cookies?.token ||
                  req.cookies?.['better-auth.session_token'];

    if (!token) {
        req.user = null;
        return next();
    }

    // Try JWT verification first
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = {
            steam_id: decoded.steam_id || decoded.steamId || decoded.id,
            steam_username: decoded.username || decoded.name || decoded.displayName,
            steam_avatar: decoded.avatar || decoded.image,
            steam_profile_url: decoded.profile_url || decoded.profileUrl,
            id: decoded.userId || decoded.id,
            ...decoded
        };
        return next();
    } catch (error) {
        // JWT verification failed, try Better Auth session
        verifyBetterAuthSession(token)
            .then(user => {
                req.user = user;
                next();
            })
            .catch(error => {
                req.user = null;
                next();
            });
    }
}

/**
 * Verify that the authenticated user matches the requested userId
 * Use this after dualAuth to ensure users can only access their own data
 */
function requireOwnData(req, res, next) {
    const requestedUserId = req.params.userId;
    const authenticatedUserId = req.user?.steam_id || req.user?.id;

    if (!authenticatedUserId) {
        return res.status(401).json({
            success: false,
            error: 'Authentication required'
        });
    }

    if (requestedUserId !== authenticatedUserId) {
        return res.status(403).json({
            success: false,
            error: 'Forbidden',
            message: 'You can only access your own portfolio data'
        });
    }

    next();
}

module.exports = {
    initialize,
    dualAuth,
    optionalAuth,
    requireOwnData,
    verifyBetterAuthSession,
    syncUserToLegacy,
    JWT_SECRET
};
