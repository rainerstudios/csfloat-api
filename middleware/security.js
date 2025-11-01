/**
 * Security Middleware Configuration
 * Includes rate limiting, helmet, and CORS
 */

const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

/**
 * Helmet configuration for security headers
 */
const helmetConfig = helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
        },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" }
});

/**
 * Rate limiting configurations
 */

// General API rate limit (100 requests per 15 minutes)
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    message: {
        success: false,
        error: {
            message: 'Too many requests, please try again later',
            code: 'RATE_LIMIT_EXCEEDED',
            retryAfter: '15 minutes'
        }
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
        // Skip rate limiting for health check
        return req.path === '/health';
    }
});

// Strict rate limit for expensive operations (10 requests per 15 minutes)
const strictLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: {
        success: false,
        error: {
            message: 'Too many requests for this operation, please try again later',
            code: 'RATE_LIMIT_EXCEEDED',
            retryAfter: '15 minutes'
        }
    },
    standardHeaders: true,
    legacyHeaders: false
});

// Float inspection rate limit (30 per minute)
const floatLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 30,
    message: {
        success: false,
        error: {
            message: 'Too many float inspection requests, please slow down',
            code: 'FLOAT_RATE_LIMIT_EXCEEDED',
            retryAfter: '1 minute'
        }
    },
    standardHeaders: true,
    legacyHeaders: false
});

// Bulk operation rate limit (5 per minute)
const bulkLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 5,
    message: {
        success: false,
        error: {
            message: 'Too many bulk operations, please wait before trying again',
            code: 'BULK_RATE_LIMIT_EXCEEDED',
            retryAfter: '1 minute'
        }
    },
    standardHeaders: true,
    legacyHeaders: false
});

/**
 * CORS configuration
 */
const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (mobile apps, Postman, etc.)
        if (!origin) return callback(null, true);

        // In production, check against whitelist
        const allowedOrigins = process.env.ALLOWED_ORIGINS
            ? process.env.ALLOWED_ORIGINS.split(',')
            : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173'];

        if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development') {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization']
};

/**
 * Request sanitization middleware
 * Prevents common injection attacks
 */
const sanitizeInput = (req, res, next) => {
    const sanitize = (obj) => {
        if (typeof obj !== 'object' || obj === null) return obj;

        for (let key in obj) {
            if (typeof obj[key] === 'string') {
                // Remove potential SQL injection characters
                obj[key] = obj[key].replace(/[;'"\\]/g, '');

                // Limit string length to prevent DoS
                if (obj[key].length > 10000) {
                    obj[key] = obj[key].substring(0, 10000);
                }
            } else if (typeof obj[key] === 'object') {
                sanitize(obj[key]);
            }
        }
        return obj;
    };

    // Sanitize body, query, and params
    if (req.body) req.body = sanitize(req.body);
    if (req.query) req.query = sanitize(req.query);
    if (req.params) req.params = sanitize(req.params);

    next();
};

/**
 * Body size limits by endpoint
 */
const bodySizeLimits = {
    small: '100kb',   // For simple requests
    medium: '1mb',    // For batch operations
    large: '10mb'     // For file uploads (if needed)
};

module.exports = {
    helmetConfig,
    generalLimiter,
    strictLimiter,
    floatLimiter,
    bulkLimiter,
    corsOptions,
    sanitizeInput,
    bodySizeLimits
};
