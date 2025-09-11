/**
 * Shared Constants for CS2 Float Extension
 * Centralized configuration and constants
 */

export const EXTENSION_CONFIG = {
    VERSION: '1.6.0',
    NAME: 'CS2 Float Checker Pro',
    API_BASE_URL: 'https://api.cs2floatchecker.com',
    USER_AGENT: 'CS2FloatChecker/1.6.0'
};

export const API_CONFIG = {
    BULK_DELAY: 2000,
    BULK_SIZE: 10,
    MIN_BULK_SIZE: 3,
    MAX_REQUESTS_PER_SECOND: 2,
    REQUEST_WINDOW: 1000,
    MAX_RETRIES: 3,
    BASE_DELAY: 1500,
    GLOBAL_REQUEST_DELAY: 800,
    INDIVIDUAL_REQUEST_DELAY: 1200
};

export const WEAR_RANGES = {
    FACTORY_NEW: { min: 0.00, max: 0.07, color: '#4ade80', shortName: 'FN', name: 'Factory New' },
    MINIMAL_WEAR: { min: 0.07, max: 0.15, color: '#22c55e', shortName: 'MW', name: 'Minimal Wear' },
    FIELD_TESTED: { min: 0.15, max: 0.38, color: '#facc15', shortName: 'FT', name: 'Field-Tested' },
    WELL_WORN: { min: 0.38, max: 0.45, color: '#fb923c', shortName: 'WW', name: 'Well-Worn' },
    BATTLE_SCARRED: { min: 0.45, max: 1.00, color: '#ef4444', shortName: 'BS', name: 'Battle-Scarred' }
};

export const FLOAT_CONDITIONS = [
    { min: 0, max: 7, color: 'green' },
    { min: 7, max: 15, color: '#18a518' },
    { min: 15, max: 38, color: '#9acd32' },
    { min: 38, max: 45, color: '#cd5c5c' },
    { min: 45, max: 100, color: '#f92424' }
];

export const CSS_CLASSES = {
    // Float display
    FLOAT_DISPLAY: 'cs2-float-display',
    FLOAT_VALUE: 'cs2-float-value',
    FLOAT_COPYABLE: 'cs2-float-copyable',
    FLOAT_BAR: 'cs2-float-bar-container',
    FLOAT_RANKING: 'cs2-float-ranking',
    
    // Components
    PATTERN_DISPLAY: 'cs2-pattern-display',
    PROFIT_DISPLAY: 'cs2-profit-display',
    TRADE_HOLD: 'cs2-trade-hold',
    QUICK_BUY: 'cs2-quick-buy',
    
    // Filters
    FILTER_PANEL: 'cs2-filter-panel',
    FILTER_TOGGLE: 'cs2-filter-toggle-btn'
};

export const SELECTORS = {
    // Steam Market
    MARKET_LISTING_ROW: '.market_listing_row',
    MARKET_LISTING_PRICE: '.market_listing_price',
    MARKET_LISTING_NAME: '.market_listing_item_name',
    MARKET_LISTING_GAME: '.market_listing_game_name',
    
    // Steam Inventory
    INVENTORY_ITEM: '.item',
    INVENTORY_ITEM_ACTION: '.item_market_action_button_contents',
    
    // General
    STEAM_BUTTON: '.btn_green_white_innerfade',
    STEAM_INPUT: '.gray_bevel'
};

export const URLS = {
    MARKET_LISTINGS: '/market/listings/',
    MARKET_SEARCH: '/market/search',
    INVENTORY: '/inventory',
    TRADE_OFFERS: '/tradeoffer'
};

export const ITEM_TYPES = {
    NON_FLOAT_PATTERNS: [
        'Patch |',
        'Music Kit |',
        'Sealed Graffiti |',
        ' Case ',
        ' Key',
        'Tool',
        'Agent |'
    ]
};

export const PATTERN_TIERS = {
    BLUE_GEM: {
        TIER_1: { min: 90, name: 'Tier 1 Blue Gem', color: '#0066ff' },
        TIER_2: { min: 80, name: 'Tier 2 Blue Gem', color: '#3399ff' },
        TIER_3: { min: 70, name: 'Tier 3 Blue Gem', color: '#66ccff' }
    },
    DOPPLER: {
        RUBY: { name: 'Ruby', color: '#ff0066' },
        SAPPHIRE: { name: 'Sapphire', color: '#0066ff' },
        BLACK_PEARL: { name: 'Black Pearl', color: '#333333' },
        EMERALD: { name: 'Emerald', color: '#00ff66' }
    },
    FADE: {
        FULL_FADE: { min: 95, name: 'Full Fade', color: '#ff6600' },
        HIGH_FADE: { min: 85, name: 'High Fade', color: '#ff9933' },
        MID_FADE: { min: 75, name: 'Mid Fade', color: '#ffcc66' }
    }
};

export const STEAM_FEES = {
    STEAM_FEE: 0.05,      // 5%
    PUBLISHER_FEE: 0.10,  // 10%
    TOTAL_FEE: 0.15       // 15%
};

export const CACHE_CONFIG = {
    EXPIRY_HOURS: 24,
    MAX_ENTRIES: 1000,
    CLEANUP_THRESHOLD: 800
};

export const ANIMATIONS = {
    FADE_IN: 'fadeIn 0.3s ease-in',
    SLIDE_DOWN: 'slideDown 0.2s ease-out',
    PULSE: 'pulse 2s ease-in-out infinite',
    SHIMMER: 'shimmer 3s ease-in-out infinite'
};

export const Z_INDEX = {
    TOOLTIP: 10000,
    MODAL: 9999,
    OVERLAY: 9998,
    DROPDOWN: 9997,
    FLOAT_DISPLAY: 1000,
    COPY_FEEDBACK: 99999
};

export const TIMEOUTS = {
    TOOLTIP_DELAY: 200,
    COPY_FEEDBACK: 1000,
    COMPONENT_LOAD: 200,
    API_RETRY: 2000,
    BULK_PROCESSING: 2000
};