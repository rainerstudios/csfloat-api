/**
 * General Helper Functions for CS2 Float Extension
 * Utility functions that don't fit into other specific categories
 */

/**
 * Create a deep copy of an object
 * @param {any} obj - Object to clone
 * @returns {any} Deep copy of the object
 */
export function deepClone(obj) {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }
    
    if (obj instanceof Date) {
        return new Date(obj.getTime());
    }
    
    if (obj instanceof Array) {
        return obj.map(item => deepClone(item));
    }
    
    if (typeof obj === 'object') {
        const cloned = {};
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                cloned[key] = deepClone(obj[key]);
            }
        }
        return cloned;
    }
    
    return obj;
}

/**
 * Generate a unique ID
 * @param {string} prefix - Optional prefix
 * @returns {string} Unique ID
 */
export function generateId(prefix = 'cs2') {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `${prefix}-${timestamp}-${random}`;
}

/**
 * Sleep for a specified duration
 * @param {number} ms - Duration in milliseconds
 * @returns {Promise} Promise that resolves after the duration
 */
export function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 * @param {Function} fn - Function to retry
 * @param {Object} options - Retry options
 * @returns {Promise} Promise that resolves with the function result
 */
export async function retryWithBackoff(fn, options = {}) {
    const {
        maxRetries = 3,
        baseDelay = 1000,
        maxDelay = 10000,
        backoffFactor = 2
    } = options;
    
    let lastError;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            
            if (attempt === maxRetries) {
                break;
            }
            
            const delay = Math.min(
                baseDelay * Math.pow(backoffFactor, attempt),
                maxDelay
            );
            
            await sleep(delay);
        }
    }
    
    throw lastError;
}

/**
 * Create a simple cache with TTL
 * @param {number} ttl - Time to live in milliseconds
 * @returns {Object} Cache object with get, set, and clear methods
 */
export function createCache(ttl = 300000) { // 5 minutes default
    const cache = new Map();
    
    return {
        get(key) {
            const item = cache.get(key);
            if (!item) return null;
            
            if (Date.now() > item.expiry) {
                cache.delete(key);
                return null;
            }
            
            return item.value;
        },
        
        set(key, value) {
            cache.set(key, {
                value,
                expiry: Date.now() + ttl
            });
        },
        
        clear() {
            cache.clear();
        },
        
        size() {
            return cache.size;
        }
    };
}

/**
 * Parse Steam inspect link to extract parameters
 * @param {string} inspectLink - Steam inspect link
 * @returns {Object|null} Parsed parameters or null if invalid
 */
export function parseInspectLink(inspectLink) {
    try {
        const url = new URL(inspectLink);
        const params = new URLSearchParams(url.pathname.split('csgo_econ_action_preview')[1]);
        
        return {
            s: params.get('S'),
            a: params.get('A'),
            d: params.get('D'),
            m: params.get('M')
        };
    } catch (error) {
        return null;
    }
}

/**
 * Extract asset ID from Steam market listing
 * @param {HTMLElement} listingElement - Market listing element
 * @returns {string|null} Asset ID or null if not found
 */
export function extractAssetId(listingElement) {
    try {
        // Try to find asset ID in data attributes
        const assetId = listingElement.dataset.listingid || 
                       listingElement.getAttribute('data-listingid');
        
        if (assetId) return assetId;
        
        // Try to find in inspect link
        const inspectLink = listingElement.querySelector('a[href*="steam://rungame"]');
        if (inspectLink) {
            const href = inspectLink.getAttribute('href');
            const params = parseInspectLink(href);
            return params?.a || null;
        }
        
        return null;
    } catch (error) {
        console.error('Error extracting asset ID:', error);
        return null;
    }
}

/**
 * Get item name from market listing
 * @param {HTMLElement} listingElement - Market listing element
 * @returns {string|null} Item name or null if not found
 */
export function getItemName(listingElement) {
    try {
        const nameElement = listingElement.querySelector('.market_listing_item_name');
        return nameElement ? nameElement.textContent.trim() : null;
    } catch (error) {
        console.error('Error getting item name:', error);
        return null;
    }
}

/**
 * Check if item is a CS2/CSGO item
 * @param {HTMLElement} listingElement - Market listing element
 * @returns {boolean} True if CS2/CSGO item
 */
export function isCS2Item(listingElement) {
    try {
        const gameElement = listingElement.querySelector('.market_listing_game_name');
        if (!gameElement) return false;
        
        const gameText = gameElement.textContent.trim().toLowerCase();
        return gameText.includes('counter-strike') || gameText.includes('cs:go') || gameText.includes('cs2');
    } catch (error) {
        return false;
    }
}

/**
 * Check if item has float value
 * @param {string} itemName - Item name
 * @returns {boolean} True if item has float
 */
export function hasFloatValue(itemName) {
    if (!itemName) return false;
    
    const nonFloatPatterns = [
        'Patch |',
        'Music Kit |',
        'Sealed Graffiti |',
        ' Case ',
        ' Key',
        'Tool',
        'Agent |',
        'Sticker |'
    ];
    
    return !nonFloatPatterns.some(pattern => itemName.includes(pattern));
}

/**
 * Convert RGB to hex color
 * @param {number} r - Red component (0-255)
 * @param {number} g - Green component (0-255)
 * @param {number} b - Blue component (0-255)
 * @returns {string} Hex color string
 */
export function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(x => {
        const hex = x.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    }).join('');
}

/**
 * Convert hex to RGB color
 * @param {string} hex - Hex color string
 * @returns {Object|null} RGB object or null if invalid
 */
export function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

/**
 * Interpolate between two colors
 * @param {string} color1 - First color (hex)
 * @param {string} color2 - Second color (hex)
 * @param {number} factor - Interpolation factor (0-1)
 * @returns {string} Interpolated color (hex)
 */
export function interpolateColor(color1, color2, factor) {
    const rgb1 = hexToRgb(color1);
    const rgb2 = hexToRgb(color2);
    
    if (!rgb1 || !rgb2) return color1;
    
    const r = Math.round(rgb1.r + (rgb2.r - rgb1.r) * factor);
    const g = Math.round(rgb1.g + (rgb2.g - rgb1.g) * factor);
    const b = Math.round(rgb1.b + (rgb2.b - rgb1.b) * factor);
    
    return rgbToHex(r, g, b);
}

/**
 * Check if current page is a Steam market page
 * @returns {boolean} True if on Steam market
 */
export function isMarketPage() {
    return window.location.hostname === 'steamcommunity.com' && 
           window.location.pathname.includes('/market/');
}

/**
 * Check if current page is a Steam inventory page
 * @returns {boolean} True if on Steam inventory
 */
export function isInventoryPage() {
    return window.location.hostname === 'steamcommunity.com' && 
           window.location.pathname.includes('/inventory');
}

/**
 * Get current Steam page type
 * @returns {string} Page type identifier
 */
export function getPageType() {
    const url = window.location.href;
    
    if (url.includes('/market/listings/')) return 'market-listing';
    if (url.includes('/market/search')) return 'market-search';
    if (url.includes('/market/')) return 'market-home';
    if (url.includes('/inventory')) return 'inventory';
    if (url.includes('/tradeoffer')) return 'trade-offer';
    
    return 'unknown';
}