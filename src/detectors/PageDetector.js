/**
 * Page Detector - Detects and classifies Steam page types
 * Provides utilities for determining what kind of Steam page we're on
 */

import { URLS } from '../utils/constants.js';

export class PageDetector {
    constructor(options = {}) {
        this.contentManager = options.contentManager;
        this.log = this.contentManager?.log.bind(this.contentManager) || console.log;
    }
    
    /**
     * Initialize the page detector
     */
    init() {
        this.log('PageDetector initialized');
        return Promise.resolve();
    }
    
    /**
     * Check if current page is a Steam market page
     * @returns {boolean} True if on Steam market
     */
    isMarketPage() {
        return window.location.hostname === 'steamcommunity.com' && 
               window.location.pathname.includes('/market/');
    }
    
    /**
     * Check if current page is a Steam inventory page
     * @returns {boolean} True if on Steam inventory
     */
    isInventoryPage() {
        return window.location.hostname === 'steamcommunity.com' && 
               window.location.pathname.includes('/inventory');
    }
    
    /**
     * Check if current page is a trade offer page
     * @returns {boolean} True if on trade offer page
     */
    isTradeOfferPage() {
        return window.location.hostname === 'steamcommunity.com' && 
               window.location.pathname.includes('/tradeoffer');
    }
    
    /**
     * Check if current page is a market listing page (not search)
     * @returns {boolean} True if on individual item listing page
     */
    isMarketListingPage() {
        const url = window.location.href;
        return url.includes('/market/listings/') && !url.includes('/market/search');
    }
    
    /**
     * Check if current page is a market search page
     * @returns {boolean} True if on market search page
     */
    isMarketSearchPage() {
        return window.location.href.includes('/market/search');
    }
    
    /**
     * Check if current page is the main market page
     * @returns {boolean} True if on main market page
     */
    isMarketHomePage() {
        const path = window.location.pathname;
        return path === '/market/' || path === '/market';
    }
    
    /**
     * Check if current page is a CS2/CSGO related page
     * @returns {boolean} True if CS2/CSGO page
     */
    isCS2Page() {
        const url = window.location.href;
        return url.includes('appid=730') || 
               url.includes('Counter-Strike') ||
               url.includes('CS:GO') ||
               url.includes('CS2');
    }
    
    /**
     * Get the current page type
     * @returns {string} Page type identifier
     */
    getPageType() {
        const url = window.location.href;
        const path = window.location.pathname;
        
        // Market pages
        if (this.isMarketSearchPage()) {
            return 'market-search';
        }
        if (this.isMarketListingPage()) {
            return 'market-listing';
        }
        if (this.isMarketHomePage()) {
            return 'market-home';
        }
        if (this.isMarketPage()) {
            return 'market-other';
        }
        
        // Other Steam pages
        if (this.isInventoryPage()) {
            return 'inventory';
        }
        if (this.isTradeOfferPage()) {
            return 'trade-offer';
        }
        
        // Profile pages
        if (path.includes('/id/') || path.includes('/profiles/')) {
            return 'profile';
        }
        
        return 'unknown';
    }
    
    /**
     * Get detailed page information
     * @returns {Object} Page information object
     */
    getPageInfo() {
        const pageType = this.getPageType();
        const url = window.location.href;
        const path = window.location.pathname;
        
        const info = {
            type: pageType,
            url,
            path,
            hostname: window.location.hostname,
            isCS2: this.isCS2Page(),
            isSteam: window.location.hostname === 'steamcommunity.com'
        };
        
        // Add specific info based on page type
        switch (pageType) {
            case 'market-listing':
                info.itemInfo = this.extractMarketItemInfo();
                break;
                
            case 'market-search':
                info.searchParams = this.extractSearchParams();
                break;
                
            case 'inventory':
                info.inventoryInfo = this.extractInventoryInfo();
                break;
                
            case 'trade-offer':
                info.tradeOfferInfo = this.extractTradeOfferInfo();
                break;
        }
        
        return info;
    }
    
    /**
     * Extract market item information from listing page
     * @returns {Object|null} Item information
     */
    extractMarketItemInfo() {
        try {
            const pathParts = window.location.pathname.split('/');
            const appId = pathParts[3]; // /market/listings/730/Item%20Name
            const itemName = decodeURIComponent(pathParts[4] || '');
            
            return {
                appId,
                itemName,
                isCS2: appId === '730'
            };
        } catch (error) {
            return null;
        }
    }
    
    /**
     * Extract search parameters from market search page
     * @returns {Object} Search parameters
     */
    extractSearchParams() {
        const urlParams = new URLSearchParams(window.location.search);
        return {
            query: urlParams.get('q') || '',
            appId: urlParams.get('appid') || '',
            category: urlParams.get('category_730_ItemSet[]') || '',
            quality: urlParams.get('category_730_Quality[]') || '',
            rarity: urlParams.get('category_730_Rarity[]') || ''
        };
    }
    
    /**
     * Extract inventory information
     * @returns {Object|null} Inventory information
     */
    extractInventoryInfo() {
        try {
            const pathParts = window.location.pathname.split('/');
            const userType = pathParts[1]; // 'id' or 'profiles'
            const userId = pathParts[2];
            const appId = window.location.hash?.split('/')[1] || '';
            
            return {
                userType,
                userId,
                appId,
                isCS2: appId === '730'
            };
        } catch (error) {
            return null;
        }
    }
    
    /**
     * Extract trade offer information
     * @returns {Object|null} Trade offer information
     */
    extractTradeOfferInfo() {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const tradeOfferId = urlParams.get('tradeofferid');
            const partner = urlParams.get('partner');
            
            return {
                tradeOfferId,
                partner
            };
        } catch (error) {
            return null;
        }
    }
    
    /**
     * Check if page should show float filters
     * @returns {boolean} True if filters should be shown
     */
    shouldShowFilters() {
        // Only show filters on individual market listing pages, not search pages
        return this.isMarketListingPage() && this.isCS2Page();
    }
    
    /**
     * Check if page should show float displays
     * @returns {boolean} True if float displays should be shown
     */
    shouldShowFloats() {
        const pageType = this.getPageType();
        const allowedPages = ['market-listing', 'inventory', 'trade-offer'];
        return allowedPages.includes(pageType) && this.isCS2Page();
    }
    
    /**
     * Wait for page to be ready for processing
     * @param {number} timeout - Timeout in milliseconds
     * @returns {Promise<boolean>} True if page is ready
     */
    async waitForPageReady(timeout = 10000) {
        const startTime = Date.now();
        
        while (Date.now() - startTime < timeout) {
            if (this.isPageReady()) {
                return true;
            }
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        return false;
    }
    
    /**
     * Check if page is ready for processing
     * @returns {boolean} True if page is ready
     */
    isPageReady() {
        if (document.readyState !== 'complete') {
            return false;
        }
        
        const pageType = this.getPageType();
        
        switch (pageType) {
            case 'market-listing':
                return this.isMarketListingReady();
                
            case 'inventory':
                return this.isInventoryReady();
                
            case 'trade-offer':
                return this.isTradeOfferReady();
                
            default:
                return true;
        }
    }
    
    /**
     * Check if market listing page is ready
     * @returns {boolean} True if ready
     */
    isMarketListingReady() {
        const listings = document.querySelectorAll('.market_listing_row');
        return listings.length > 0;
    }
    
    /**
     * Check if inventory page is ready
     * @returns {boolean} True if ready
     */
    isInventoryReady() {
        const inventory = document.querySelector('#inventories');
        return inventory !== null;
    }
    
    /**
     * Check if trade offer page is ready
     * @returns {boolean} True if ready
     */
    isTradeOfferReady() {
        const tradeContent = document.querySelector('.tradeoffer_items');
        return tradeContent !== null;
    }
    
    /**
     * Handle page navigation events
     * @param {Function} callback - Callback to execute on navigation
     */
    onPageChange(callback) {
        // Monitor history changes (Steam uses AJAX navigation)
        const originalPushState = history.pushState;
        const originalReplaceState = history.replaceState;
        
        history.pushState = function(...args) {
            originalPushState.apply(history, args);
            setTimeout(callback, 100);
        };
        
        history.replaceState = function(...args) {
            originalReplaceState.apply(history, args);
            setTimeout(callback, 100);
        };
        
        window.addEventListener('popstate', () => {
            setTimeout(callback, 100);
        });
        
        // Also monitor for DOM changes that might indicate navigation
        const observer = new MutationObserver((mutations) => {
            const hasSignificantChanges = mutations.some(mutation => 
                mutation.type === 'childList' && 
                mutation.addedNodes.length > 0 &&
                Array.from(mutation.addedNodes).some(node => 
                    node.nodeType === Node.ELEMENT_NODE &&
                    (node.classList?.contains('market_listing_row') ||
                     node.classList?.contains('item') ||
                     node.id === 'inventories')
                )
            );
            
            if (hasSignificantChanges) {
                setTimeout(callback, 200);
            }
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        return () => {
            observer.disconnect();
        };
    }
    
    /**
     * Handle events from content manager
     * @param {string} eventType - Event type
     * @param {any} data - Event data
     */
    handleEvent(eventType, data) {
        switch (eventType) {
            case 'settingsChanged':
                // Page detector doesn't need to react to settings changes
                break;
                
            default:
                // Ignore unknown events
                break;
        }
    }
    
    /**
     * Destroy the page detector
     */
    destroy() {
        // No cleanup needed for page detector
    }
}