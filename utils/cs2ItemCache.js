/**
 * CS2 Item Cache Manager
 *
 * Downloads and caches CS2 item data from ByMykel's CSGO-API
 * Refreshes cache daily to ensure data is up-to-date
 */

const fetch = require('node-fetch');
const winston = require('winston');

class CS2ItemCache {
    constructor() {
        this.items = [];
        this.lastFetchTime = null;
        this.CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
        this.API_URL = 'https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/skins.json';
        this.isInitialized = false;
        this.isFetching = false;
    }

    /**
     * Initialize the cache by fetching items on startup
     */
    async initialize() {
        if (this.isInitialized) {
            return;
        }

        winston.info('[CS2ItemCache] Initializing item cache...');
        await this.fetchItems();
        this.isInitialized = true;

        // Set up automatic daily refresh
        this.scheduleRefresh();
    }

    /**
     * Check if cache needs refresh (older than 24 hours)
     */
    needsRefresh() {
        if (!this.lastFetchTime) {
            return true;
        }

        const timeSinceLastFetch = Date.now() - this.lastFetchTime;
        return timeSinceLastFetch >= this.CACHE_DURATION;
    }

    /**
     * Fetch items from ByMykel's API
     */
    async fetchItems() {
        if (this.isFetching) {
            winston.debug('[CS2ItemCache] Fetch already in progress, skipping...');
            return this.items;
        }

        try {
            this.isFetching = true;
            winston.info('[CS2ItemCache] Fetching CS2 items from API...');

            const response = await fetch(this.API_URL, {
                timeout: 30000,
                headers: {
                    'User-Agent': 'CSFloat-API/1.5.0'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            if (data && Array.isArray(data)) {
                this.items = data;
                this.lastFetchTime = Date.now();
                winston.info(`[CS2ItemCache] Successfully cached ${this.items.length} items`);
            } else {
                winston.error('[CS2ItemCache] Invalid response format from API');
            }

            return this.items;
        } catch (error) {
            winston.error('[CS2ItemCache] Failed to fetch items:', error.message);

            // If we have cached items, continue using them
            if (this.items.length > 0) {
                winston.warn('[CS2ItemCache] Using stale cache due to fetch error');
                return this.items;
            }

            throw error;
        } finally {
            this.isFetching = false;
        }
    }

    /**
     * Get all cached items (refresh if needed)
     */
    async getItems() {
        if (this.needsRefresh()) {
            await this.fetchItems();
        }

        return this.items;
    }

    /**
     * Search items by name
     * @param {string} query - Search query
     * @param {number} limit - Maximum results to return (default: 20)
     */
    async search(query, limit = 20) {
        const items = await this.getItems();

        if (!query || query.trim().length === 0) {
            return items.slice(0, limit);
        }

        const searchTerm = query.toLowerCase().trim();

        // Filter items by name match
        const results = items.filter(item => {
            const itemName = item.name.toLowerCase();
            return itemName.includes(searchTerm);
        });

        // Sort by relevance (exact matches first, then starts with, then contains)
        results.sort((a, b) => {
            const aName = a.name.toLowerCase();
            const bName = b.name.toLowerCase();

            // Exact match
            if (aName === searchTerm) return -1;
            if (bName === searchTerm) return 1;

            // Starts with query
            if (aName.startsWith(searchTerm) && !bName.startsWith(searchTerm)) return -1;
            if (bName.startsWith(searchTerm) && !aName.startsWith(searchTerm)) return 1;

            // Alphabetical
            return aName.localeCompare(bName);
        });

        return results.slice(0, limit);
    }

    /**
     * Get item by exact name
     * @param {string} name - Exact item name
     */
    async getItemByName(name) {
        const items = await this.getItems();
        return items.find(item => item.name === name);
    }

    /**
     * Get cache statistics
     */
    getStats() {
        return {
            totalItems: this.items.length,
            lastFetchTime: this.lastFetchTime,
            cacheAge: this.lastFetchTime ? Date.now() - this.lastFetchTime : null,
            needsRefresh: this.needsRefresh(),
            nextRefresh: this.lastFetchTime
                ? new Date(this.lastFetchTime + this.CACHE_DURATION).toISOString()
                : null
        };
    }

    /**
     * Schedule automatic daily refresh
     */
    scheduleRefresh() {
        // Check every hour if refresh is needed
        setInterval(async () => {
            if (this.needsRefresh()) {
                winston.info('[CS2ItemCache] Cache expired, refreshing...');
                await this.fetchItems();
            }
        }, 60 * 60 * 1000); // Check every hour

        winston.info('[CS2ItemCache] Scheduled automatic daily refresh');
    }

    /**
     * Force refresh the cache
     */
    async forceRefresh() {
        winston.info('[CS2ItemCache] Forcing cache refresh...');
        return await this.fetchItems();
    }
}

// Export singleton instance
module.exports = new CS2ItemCache();
