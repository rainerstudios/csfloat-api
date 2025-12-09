/**
 * Request Deduplicator
 * Prevents duplicate Valve API calls when multiple users request the same item simultaneously
 *
 * Example: If 10 users check the same item within 1 second:
 * - Without dedup: 10 Valve API calls
 * - With dedup: 1 Valve API call (all 10 users get the same result)
 */

const winston = require('winston');

class RequestDeduplicator {
    constructor() {
        // Map of inspect URL -> Promise (for in-flight requests)
        this.pendingRequests = new Map();

        // Statistics
        this.stats = {
            hits: 0,           // Requests that were deduplicated
            misses: 0,         // Requests that went through normally
            totalSaved: 0      // Total Valve API calls saved
        };
    }

    /**
     * Wraps a request function with deduplication logic
     * @param {string} key - Unique identifier for the request (usually inspect URL)
     * @param {Function} requestFn - Async function that performs the actual request
     * @returns {Promise} - Promise that resolves with the request result
     */
    async deduplicate(key, requestFn) {
        // Check if same request is already in progress
        if (this.pendingRequests.has(key)) {
            this.stats.hits++;
            this.stats.totalSaved++;
            winston.debug(`[Dedup HIT] Request already in progress: ${key.substring(0, 50)}...`);

            // Return existing promise (all waiting clients will get the same result)
            return this.pendingRequests.get(key);
        }

        // No existing request - create new one
        this.stats.misses++;
        winston.debug(`[Dedup MISS] Starting new request: ${key.substring(0, 50)}...`);

        // Create promise for this request
        const promise = (async () => {
            try {
                const result = await requestFn();
                return result;
            } catch (error) {
                throw error;
            } finally {
                // Always remove from pending map when done (success or failure)
                this.pendingRequests.delete(key);
                winston.debug(`[Dedup COMPLETE] Request finished: ${key.substring(0, 50)}...`);
            }
        })();

        // Store promise in map
        this.pendingRequests.set(key, promise);

        return promise;
    }

    /**
     * Get current deduplication statistics
     */
    getStats() {
        const total = this.stats.hits + this.stats.misses;
        const hitRate = total > 0 ? ((this.stats.hits / total) * 100).toFixed(2) : 0;

        return {
            ...this.stats,
            total,
            hitRate: `${hitRate}%`,
            pendingCount: this.pendingRequests.size
        };
    }

    /**
     * Reset statistics (useful for monitoring)
     */
    resetStats() {
        this.stats = {
            hits: 0,
            misses: 0,
            totalSaved: 0
        };
    }

    /**
     * Clear all pending requests (emergency cleanup)
     */
    clear() {
        this.pendingRequests.clear();
        winston.warn('[Dedup] Cleared all pending requests');
    }
}

module.exports = RequestDeduplicator;
