/**
 * Request Validation Schemas using Zod
 */

const { z } = require('zod');
const { ApiError } = require('./errorHandler');

/**
 * Portfolio validation schemas
 */
const portfolioSchemas = {
    // Add investment schema
    addInvestment: z.object({
        userId: z.string().min(1, 'User ID is required'),
        itemName: z.string().min(3, 'Item name must be at least 3 characters'),
        purchasePrice: z.number().min(0, 'Purchase price must be non-negative'),
        quantity: z.number().int().min(1).optional().default(1),
        inspectLink: z.string().url().optional().or(z.literal('')),
        marketplace: z.string().optional().default('Steam'),
        notes: z.string().optional()
    }),

    // Batch add investments schema
    batchAdd: z.object({
        userId: z.string().min(1, 'User ID is required'),
        investments: z.array(
            z.object({
                itemName: z.string().min(3),
                purchasePrice: z.number().min(0),
                quantity: z.number().int().min(1).optional().default(1),
                marketplace: z.string().optional(),
                notes: z.string().optional()
            })
        ).min(1, 'At least one investment is required').max(50, 'Maximum 50 investments per batch')
    }),

    // Record sale schema
    recordSale: z.object({
        investmentId: z.number().int().positive('Investment ID must be positive'),
        quantity: z.number().int().min(1, 'Quantity must be at least 1'),
        salePrice: z.number().min(0, 'Sale price must be non-negative'),
        marketplace: z.string().optional(),
        notes: z.string().optional()
    }),

    // Update investment schema
    updateInvestment: z.object({
        purchasePrice: z.number().min(0).optional(),
        quantity: z.number().int().min(1).optional(),
        marketplace: z.string().optional(),
        notes: z.string().optional()
    }).refine(data => Object.keys(data).length > 0, {
        message: 'At least one field must be provided for update'
    })
};

/**
 * Float inspection validation schemas
 */
const floatSchemas = {
    // Single float check
    floatCheck: z.object({
        inspectLink: z.string().url('Invalid inspect link format')
    }),

    // Bulk float check
    bulkFloatCheck: z.object({
        inspectLinks: z.array(
            z.string().url()
        ).min(1, 'At least one inspect link required').max(100, 'Maximum 100 links per request')
    })
};

/**
 * Price validation schemas
 */
const priceSchemas = {
    // Get price
    getPrice: z.object({
        itemName: z.string().min(3, 'Item name must be at least 3 characters'),
        market: z.enum(['buff163', 'skinport', 'csfloat', 'steam', 'csmoney']).optional()
    }),

    // Bulk price check
    bulkPrice: z.object({
        itemNames: z.array(
            z.string().min(3)
        ).min(1, 'At least one item name required').max(50, 'Maximum 50 items per request')
    })
};

/**
 * Validation middleware factory
 * Creates middleware that validates request body against a schema
 *
 * @param {z.ZodSchema} schema - Zod validation schema
 * @returns {Function} - Express middleware function
 */
const validate = (schema) => {
    return (req, res, next) => {
        try {
            // Validate request body
            const validated = schema.parse(req.body);

            // Replace req.body with validated data
            req.body = validated;

            next();
        } catch (error) {
            // Pass Zod validation error to error handler
            next(error);
        }
    };
};

/**
 * Validate query parameters
 */
const validateQuery = (schema) => {
    return (req, res, next) => {
        try {
            // Convert query params to proper types
            const query = { ...req.query };

            // Convert numeric strings to numbers
            Object.keys(query).forEach(key => {
                if (!isNaN(query[key]) && query[key] !== '') {
                    query[key] = Number(query[key]);
                }
            });

            const validated = schema.parse(query);
            req.query = validated;
            next();
        } catch (error) {
            next(error);
        }
    };
};

/**
 * Validate URL parameters
 */
const validateParams = (schema) => {
    return (req, res, next) => {
        try {
            const validated = schema.parse(req.params);
            req.params = validated;
            next();
        } catch (error) {
            next(error);
        }
    };
};

/**
 * Common query schemas
 */
const commonSchemas = {
    userId: z.object({
        userId: z.string().min(1, 'User ID is required')
    }),

    investmentId: z.object({
        investmentId: z.string().regex(/^\d+$/, 'Investment ID must be a number')
            .transform(Number)
    }),

    pagination: z.object({
        limit: z.number().int().min(1).max(100).optional().default(20),
        offset: z.number().int().min(0).optional().default(0)
    }),

    period: z.object({
        period: z.enum(['7d', '30d', '90d', '1y', 'all']).optional().default('30d')
    })
};

module.exports = {
    portfolioSchemas,
    floatSchemas,
    priceSchemas,
    commonSchemas,
    validate,
    validateQuery,
    validateParams
};
