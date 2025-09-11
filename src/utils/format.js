/**
 * Data Formatting Utilities for CS2 Float Extension
 * Functions for formatting floats, prices, and other data
 */

import { WEAR_RANGES } from './constants.js';

/**
 * Format float value for display
 * @param {number} floatValue - Float value (0-1)
 * @param {number} precision - Decimal places (default: 4)
 * @returns {string} Formatted float string
 */
export function formatFloat(floatValue, precision = 4) {
    if (typeof floatValue !== 'number' || isNaN(floatValue)) {
        return 'N/A';
    }
    
    return floatValue.toFixed(precision);
}

/**
 * Get wear condition from float value
 * @param {number} floatValue - Float value (0-1)
 * @returns {Object} Wear condition object
 */
export function getWearCondition(floatValue) {
    if (typeof floatValue !== 'number' || isNaN(floatValue)) {
        return null;
    }
    
    for (const [key, range] of Object.entries(WEAR_RANGES)) {
        if (floatValue >= range.min && floatValue < range.max) {
            return { key, ...range };
        }
    }
    
    // Handle edge case for max value
    if (floatValue === 1.0) {
        return { key: 'BATTLE_SCARRED', ...WEAR_RANGES.BATTLE_SCARRED };
    }
    
    return null;
}

/**
 * Format price for display
 * @param {number} price - Price value
 * @param {string} currency - Currency symbol (default: $)
 * @returns {string} Formatted price string
 */
export function formatPrice(price, currency = '$') {
    if (typeof price !== 'number' || isNaN(price)) {
        return 'N/A';
    }
    
    return `${currency}${price.toFixed(2)}`;
}

/**
 * Format percentage for display
 * @param {number} percentage - Percentage value (0-100)
 * @param {number} precision - Decimal places (default: 1)
 * @returns {string} Formatted percentage string
 */
export function formatPercentage(percentage, precision = 1) {
    if (typeof percentage !== 'number' || isNaN(percentage)) {
        return 'N/A';
    }
    
    return `${percentage.toFixed(precision)}%`;
}

/**
 * Format float ranking for display
 * @param {number} rank - Rank number
 * @param {number} total - Total items
 * @returns {string} Formatted ranking string
 */
export function formatFloatRanking(rank, total) {
    if (typeof rank !== 'number' || typeof total !== 'number' || rank <= 0 || total <= 0) {
        return 'N/A';
    }
    
    const percentage = ((total - rank + 1) / total) * 100;
    
    if (percentage >= 99) {
        return 'Top 1%';
    } else if (percentage >= 95) {
        return 'Top 5%';
    } else if (percentage >= 90) {
        return 'Top 10%';
    } else if (percentage >= 75) {
        return 'Top 25%';
    } else if (percentage >= 50) {
        return 'Top 50%';
    }
    
    return `Top ${Math.ceil(percentage)}%`;
}

/**
 * Format pattern seed for display
 * @param {number} paintSeed - Pattern seed
 * @returns {string} Formatted pattern string
 */
export function formatPattern(paintSeed) {
    if (typeof paintSeed !== 'number' || isNaN(paintSeed)) {
        return 'N/A';
    }
    
    return `#${paintSeed}`;
}

/**
 * Format time ago for display
 * @param {Date|string|number} date - Date to format
 * @returns {string} Formatted time ago string
 */
export function formatTimeAgo(date) {
    try {
        const now = new Date();
        const target = new Date(date);
        const diffMs = now - target;
        
        if (diffMs < 0) return 'Just now';
        
        const diffSec = Math.floor(diffMs / 1000);
        const diffMin = Math.floor(diffSec / 60);
        const diffHour = Math.floor(diffMin / 60);
        const diffDay = Math.floor(diffHour / 24);
        
        if (diffSec < 60) return 'Just now';
        if (diffMin < 60) return `${diffMin}m ago`;
        if (diffHour < 24) return `${diffHour}h ago`;
        if (diffDay < 7) return `${diffDay}d ago`;
        if (diffDay < 30) return `${Math.floor(diffDay / 7)}w ago`;
        if (diffDay < 365) return `${Math.floor(diffDay / 30)}mo ago`;
        
        return `${Math.floor(diffDay / 365)}y ago`;
    } catch (error) {
        return 'N/A';
    }
}

/**
 * Format number with appropriate units (K, M, B)
 * @param {number} num - Number to format
 * @returns {string} Formatted number string
 */
export function formatLargeNumber(num) {
    if (typeof num !== 'number' || isNaN(num)) {
        return 'N/A';
    }
    
    if (num >= 1e9) {
        return `${(num / 1e9).toFixed(1)}B`;
    }
    if (num >= 1e6) {
        return `${(num / 1e6).toFixed(1)}M`;
    }
    if (num >= 1e3) {
        return `${(num / 1e3).toFixed(1)}K`;
    }
    
    return num.toString();
}

/**
 * Sanitize text for safe display
 * @param {string} text - Text to sanitize
 * @returns {string} Sanitized text
 */
export function sanitizeText(text) {
    if (typeof text !== 'string') {
        return '';
    }
    
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Truncate text with ellipsis
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated text
 */
export function truncateText(text, maxLength) {
    if (typeof text !== 'string') {
        return '';
    }
    
    if (text.length <= maxLength) {
        return text;
    }
    
    return text.substring(0, maxLength - 3) + '...';
}