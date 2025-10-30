/**
 * Steam Authentication Module
 * Handles Steam OpenID authentication using Passport
 */

const passport = require('passport');
const SteamStrategy = require('passport-steam').Strategy;
const jwt = require('jsonwebtoken');

const STEAM_API_KEY = '65223E8BE47C4CDFFE454434252C8012';
const STEAM_RETURN_URL = process.env.STEAM_RETURN_URL || 'http://localhost:3002/auth/steam/return';
const STEAM_REALM = STEAM_RETURN_URL.replace('/auth/steam/return', '');
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const JWT_SECRET = process.env.JWT_SECRET || 'cs2float-secret-key-change-in-production';

/**
 * Configure Passport Steam Strategy
 */
function configureSteamAuth(postgres) {
    passport.use(new SteamStrategy({
        returnURL: STEAM_RETURN_URL,
        realm: STEAM_REALM,
        apiKey: STEAM_API_KEY
    }, async function(identifier, profile, done) {
        try {
            // Extract Steam ID from identifier
            const steamId = identifier.match(/\d+$/)[0];

            // Create user object
            const user = {
                steam_id: steamId,
                steam_username: profile.displayName,
                steam_avatar: profile.photos && profile.photos[2] ? profile.photos[2].value : profile.photos[0].value,
                steam_profile_url: profile._json.profileurl,
                last_login: new Date()
            };

            // Generate API key for user
            const apiKeyResult = await postgres.pool.query(`SELECT generate_user_api_key() as api_key`);
            const apiKey = apiKeyResult.rows[0].api_key;

            // Insert or update user in database
            const result = await postgres.pool.query(`
                INSERT INTO users (steam_id, steam_username, steam_avatar, steam_profile_url, api_key, last_login)
                VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (steam_id)
                DO UPDATE SET
                    steam_username = $2,
                    steam_avatar = $3,
                    steam_profile_url = $4,
                    last_login = $6
                RETURNING *
            `, [user.steam_id, user.steam_username, user.steam_avatar, user.steam_profile_url, apiKey, user.last_login]);

            return done(null, result.rows[0]);
        } catch (error) {
            console.error('Steam auth error:', error);
            return done(error);
        }
    }));

    // Serialize user for session
    passport.serializeUser((user, done) => {
        done(null, user.steam_id);
    });

    // Deserialize user from session
    passport.deserializeUser(async (steamId, done) => {
        try {
            const result = await postgres.pool.query('SELECT * FROM users WHERE steam_id = $1', [steamId]);
            if (result.rows.length > 0) {
                done(null, result.rows[0]);
            } else {
                done(new Error('User not found'));
            }
        } catch (error) {
            done(error);
        }
    });
}

/**
 * Generate JWT token for user
 */
function generateToken(user) {
    return jwt.sign({
        steam_id: user.steam_id,
        username: user.steam_username,
        avatar: user.steam_avatar
    }, JWT_SECRET, {
        expiresIn: '7d'
    });
}

/**
 * Verify JWT token
 */
function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        return null;
    }
}

/**
 * Middleware to require authentication
 */
function requireAuth(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }

    // Check for JWT token in header or query
    const token = req.headers.authorization?.replace('Bearer ', '') ||
                  req.headers['x-auth-token'] ||
                  req.query.token;

    if (token) {
        const decoded = verifyToken(token);
        if (decoded) {
            req.user = decoded;
            return next();
        }
    }

    res.status(401).json({
        success: false,
        error: 'Authentication required',
        message: 'Please log in with Steam to access this endpoint'
    });
}

/**
 * Setup authentication routes
 */
function setupAuthRoutes(app, postgres) {
    // Initiate Steam login
    app.get('/auth/steam',
        passport.authenticate('steam', { failureRedirect: '/' }),
        function(req, res) {
            res.redirect('/');
        }
    );

    // Steam callback
    app.get('/auth/steam/return',
        passport.authenticate('steam', { failureRedirect: FRONTEND_URL + '/?error=auth_failed' }),
        function(req, res) {
            // Generate JWT token for frontend
            const token = generateToken(req.user);

            // Redirect to frontend with token
            res.redirect(`${FRONTEND_URL}/auth/callback?token=${token}`);
        }
    );

    // Logout
    app.get('/auth/logout', (req, res) => {
        req.logout(() => {
            res.redirect(FRONTEND_URL);
        });
    });

    // Get current user
    app.get('/auth/me', requireAuth, async (req, res) => {
        try {
            // If user is from JWT, fetch full data from database
            if (!req.user.id) {
                const result = await postgres.pool.query(
                    'SELECT * FROM users WHERE steam_id = $1',
                    [req.user.steam_id]
                );
                if (result.rows.length > 0) {
                    req.user = result.rows[0];
                }
            }

            res.json({
                success: true,
                user: {
                    steam_id: req.user.steam_id,
                    username: req.user.steam_username,
                    avatar: req.user.steam_avatar,
                    profile_url: req.user.steam_profile_url,
                    api_key: req.user.api_key,
                    created_at: req.user.created_at
                }
            });
        } catch (error) {
            console.error('Error fetching user:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch user data'
            });
        }
    });

    // Verify token endpoint (for frontend to check if token is valid)
    app.post('/auth/verify', (req, res) => {
        const token = req.body.token || req.headers.authorization?.replace('Bearer ', '');

        if (!token) {
            return res.status(400).json({
                success: false,
                valid: false,
                error: 'No token provided'
            });
        }

        const decoded = verifyToken(token);
        if (decoded) {
            res.json({
                success: true,
                valid: true,
                user: decoded
            });
        } else {
            res.json({
                success: true,
                valid: false
            });
        }
    });
}

module.exports = {
    configureSteamAuth,
    generateToken,
    verifyToken,
    requireAuth,
    setupAuthRoutes
};
