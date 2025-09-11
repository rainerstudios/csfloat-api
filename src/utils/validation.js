/**
 * Validation Utilities for CS2 Float Extension
 * Input validation and data verification functions
 */

/**
 * Validate float value
 * @param {any} value - Value to validate
 * @returns {boolean} True if valid float
 */
export function isValidFloat(value) {
    if (typeof value !== 'number') {
        const parsed = parseFloat(value);
        if (isNaN(parsed)) return false;
        value = parsed;
    }
    
    return value >= 0 && value <= 1;
}

/**
 * Validate pattern seed
 * @param {any} value - Value to validate
 * @returns {boolean} True if valid pattern seed
 */
export function isValidPattern(value) {
    if (typeof value !== 'number') {
        const parsed = parseInt(value, 10);
        if (isNaN(parsed)) return false;
        value = parsed;
    }
    
    return Number.isInteger(value) && value >= 0 && value <= 1000;
}

/**
 * Validate price value
 * @param {any} value - Value to validate
 * @returns {boolean} True if valid price
 */
export function isValidPrice(value) {
    if (typeof value !== 'number') {
        const parsed = parseFloat(value);
        if (isNaN(parsed)) return false;
        value = parsed;
    }
    
    return value >= 0;
}

/**
 * Validate Steam asset ID
 * @param {any} assetId - Asset ID to validate
 * @returns {boolean} True if valid asset ID
 */
export function isValidAssetId(assetId) {
    if (typeof assetId !== 'string' && typeof assetId !== 'number') {
        return false;
    }
    
    const str = String(assetId);
    return /^\d+$/.test(str) && str.length > 0;
}

/**
 * Validate Steam inspect link
 * @param {string} inspectLink - Inspect link to validate
 * @returns {boolean} True if valid inspect link
 */
export function isValidInspectLink(inspectLink) {
    if (typeof inspectLink !== 'string') {
        return false;
    }
    
    return inspectLink.includes('steam://rungame/730') && 
           inspectLink.includes('+csgo_econ_action_preview');
}

/**
 * Validate URL
 * @param {string} url - URL to validate
 * @returns {boolean} True if valid URL
 */
export function isValidUrl(url) {
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
}

/**
 * Validate email address
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid email
 */
export function isValidEmail(email) {
    if (typeof email !== 'string') {
        return false;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Validate hex color
 * @param {string} color - Color string to validate
 * @returns {boolean} True if valid hex color
 */
export function isValidHexColor(color) {
    if (typeof color !== 'string') {
        return false;
    }
    
    const hexRegex = /^#([0-9A-F]{3}|[0-9A-F]{6})$/i;
    return hexRegex.test(color);
}

/**
 * Validate CSS class name
 * @param {string} className - Class name to validate
 * @returns {boolean} True if valid CSS class name
 */
export function isValidClassName(className) {
    if (typeof className !== 'string') {
        return false;
    }
    
    const classRegex = /^[a-zA-Z_-][a-zA-Z0-9_-]*$/;
    return classRegex.test(className);
}

/**
 * Validate Steam ID
 * @param {string} steamId - Steam ID to validate
 * @returns {boolean} True if valid Steam ID
 */
export function isValidSteamId(steamId) {
    if (typeof steamId !== 'string') {
        return false;
    }
    
    // Steam64 ID format
    const steam64Regex = /^7656119[0-9]{10}$/;
    return steam64Regex.test(steamId);
}

/**
 * Validate item name
 * @param {string} itemName - Item name to validate
 * @returns {boolean} True if valid item name
 */
export function isValidItemName(itemName) {
    if (typeof itemName !== 'string') {
        return false;
    }
    
    return itemName.trim().length > 0 && itemName.length <= 100;
}

/**
 * Validate range values
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {boolean} True if valid range
 */
export function isValidRange(min, max) {
    if (typeof min !== 'number' || typeof max !== 'number') {
        return false;
    }
    
    return !isNaN(min) && !isNaN(max) && min <= max;
}

/**
 * Sanitize and validate user input
 * @param {any} input - User input
 * @param {string} type - Expected type
 * @param {Object} options - Validation options
 * @returns {Object} Validation result with isValid and sanitizedValue
 */
export function sanitizeInput(input, type, options = {}) {
    const result = { isValid: false, sanitizedValue: null, error: null };
    
    try {
        switch (type) {
            case 'float':
                const floatValue = parseFloat(input);
                if (isValidFloat(floatValue)) {
                    result.isValid = true;
                    result.sanitizedValue = floatValue;
                } else {
                    result.error = 'Invalid float value (must be between 0 and 1)';
                }
                break;
                
            case 'pattern':
                const patternValue = parseInt(input, 10);
                if (isValidPattern(patternValue)) {
                    result.isValid = true;
                    result.sanitizedValue = patternValue;
                } else {
                    result.error = 'Invalid pattern seed (must be 0-1000)';
                }
                break;
                
            case 'price':
                const priceValue = parseFloat(input);
                if (isValidPrice(priceValue)) {
                    result.isValid = true;
                    result.sanitizedValue = priceValue;
                } else {
                    result.error = 'Invalid price (must be positive number)';
                }
                break;
                
            case 'string':
                if (typeof input === 'string') {
                    const trimmed = input.trim();
                    const minLength = options.minLength || 0;
                    const maxLength = options.maxLength || 1000;
                    
                    if (trimmed.length >= minLength && trimmed.length <= maxLength) {
                        result.isValid = true;
                        result.sanitizedValue = trimmed;
                    } else {
                        result.error = `String length must be between ${minLength} and ${maxLength}`;
                    }
                } else {
                    result.error = 'Value must be a string';
                }
                break;
                
            default:
                result.error = 'Unknown validation type';
        }
    } catch (error) {
        result.error = `Validation error: ${error.message}`;
    }
    
    return result;
}