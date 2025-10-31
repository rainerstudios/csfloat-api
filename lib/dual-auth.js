/**
 * Dual Authentication Middleware
 * Supports both Passport.js sessions (legacy) and Better Auth JWT tokens (new)
 * This allows for smooth migration without breaking existing authentication
 */

const jwt = require('jsonwebtoken');

// Use BETTER_AUTH_SECRET if available, fallback to JWT_SECRET
const JWT_SECRET = process.env.BETTER_AUTH_SECRET || process.env.JWT_SECRET || 'cs2float-secret-key-change-in-production';

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

    // Check for Better Auth JWT token in multiple locations
    const token = req.headers.authorization?.replace('Bearer ', '') ||
                  req.headers['x-auth-token'] ||
                  req.query.token ||
                  req.cookies?.token ||
                  req.cookies?.['better-auth.session_token'];  // Better Auth default cookie name

    if (token) {
        try {
            // Verify the JWT token
            const decoded = jwt.verify(token, JWT_SECRET);

            // Add user info to request in the same format as Passport.js
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
            // Token is invalid, but we'll fall through to 401
            console.error('JWT verification failed:', error.message);
        }
    }

    // No valid authentication found
    return res.status(401).json({
        success: false,
        error: 'Authentication required',
        message: 'Please log in with Steam to access this endpoint'
    });
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

    if (token) {
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
        } catch (error) {
            // Token invalid, but continue anyway
            req.user = null;
        }
    }

    next();
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
    dualAuth,
    optionalAuth,
    requireOwnData,
    JWT_SECRET
};
