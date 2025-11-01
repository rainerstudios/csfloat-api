/**
 * Global Error Handler Middleware
 * Catches all errors and sends consistent error responses
 */

const winston = require('winston');

/**
 * Async handler wrapper - catches errors from async route handlers
 * @param {Function} fn - Async route handler function
 * @returns {Function} - Wrapped function with error handling
 */
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Custom error class for API errors
 */
class ApiError extends Error {
    constructor(statusCode, message, code = null, details = null) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.details = details;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * Global error handler middleware
 * Should be added LAST in middleware chain
 */
const errorHandler = (err, req, res, next) => {
    let statusCode = err.statusCode || 500;
    let message = err.message || 'Internal server error';
    let code = err.code || 'INTERNAL_ERROR';
    let details = err.details || null;

    // Handle Zod validation errors (check multiple ways Zod errors can appear)
    if (err.name === 'ZodError' || (err.constructor && err.constructor.name === 'ZodError') || err.issues) {
        statusCode = 400;
        code = 'VALIDATION_ERROR';
        message = 'Request validation failed';

        // Zod errors have an 'issues' property, not 'errors'
        const issues = err.issues || err.errors || [];
        if (Array.isArray(issues)) {
            details = issues.map(e => ({
                path: Array.isArray(e.path) ? e.path.join('.') : String(e.path || ''),
                message: e.message || 'Validation error',
                code: e.code || 'invalid'
            }));
        }
    }

    // Handle PostgreSQL errors
    if (err.code && err.code.startsWith('23')) {
        statusCode = 400;
        code = 'DATABASE_ERROR';

        if (err.code === '23505') {
            message = 'Duplicate entry - record already exists';
        } else if (err.code === '23503') {
            message = 'Referenced record does not exist';
        } else if (err.code === '23502') {
            message = 'Required field is missing';
        }
    }

    // Log error details
    if (statusCode >= 500) {
        winston.error('Server error:', {
            message: err.message,
            stack: err.stack,
            statusCode,
            code,
            url: req.originalUrl,
            method: req.method,
            ip: req.ip,
            userId: req.userId || 'anonymous'
        });
    } else {
        winston.warn('Client error:', {
            message: err.message,
            statusCode,
            code,
            url: req.originalUrl,
            method: req.method
        });
    }

    // Send error response
    const errorResponse = {
        success: false,
        error: {
            message,
            code,
            ...(details && { details }),
            ...(process.env.NODE_ENV === 'development' && {
                stack: err.stack,
                raw: err
            })
        }
    };

    res.status(statusCode).json(errorResponse);
};

/**
 * 404 Not Found handler
 * Should be added BEFORE error handler
 */
const notFoundHandler = (req, res, next) => {
    const error = new ApiError(404, `Route ${req.originalUrl} not found`, 'NOT_FOUND');
    next(error);
};

/**
 * Request logging middleware
 */
const requestLogger = (req, res, next) => {
    const start = Date.now();

    res.on('finish', () => {
        const duration = Date.now() - start;
        winston.info({
            method: req.method,
            url: req.originalUrl,
            status: res.statusCode,
            duration: `${duration}ms`,
            ip: req.ip,
            userAgent: req.get('user-agent')
        });
    });

    next();
};

module.exports = {
    asyncHandler,
    ApiError,
    errorHandler,
    notFoundHandler,
    requestLogger
};
