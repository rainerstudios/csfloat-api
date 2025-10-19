/**
 * Buff163 Price Integration
 * Shows Buff163 prices alongside Steam Market prices
 *
 * HIGH-VALUE FEATURE: Arbitrage opportunity detection
 * User Impact: Find profitable trading opportunities instantly
 *
 * Buff163 is the largest Chinese CS2 skin marketplace, often with
 * lower prices than Steam, creating arbitrage opportunities
 */

class Buff163Integration {
    constructor() {
        this.enabled = true;
        this.apiBaseUrl = 'https://buff.163.com/api/market/goods';
        this.priceCache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
        this.exchangeRate = null; // CNY to USD
        this.pendingRequests = new Map();

        // Proxy URL for CORS bypass (you'll need to set up a proxy)
        this.proxyUrl = 'http://localhost:3000/api/buff163-proxy';

        this.init();
    }

    /**
     * Initialize Buff163 integration
     */
    async init() {
        console.log('[CS2 Float] Buff163 Integration initialized');

        // Get exchange rate
        await this.updateExchangeRate();

        // Create CSS
        this.injectCSS();
    }

    /**
     * Get current CNY to USD exchange rate
     */
    async updateExchangeRate() {
        try {
            // Use a free exchange rate API
            const response = await fetch('https://api.exchangerate-api.com/v4/latest/CNY');
            const data = await response.json();
            this.exchangeRate = data.rates.USD;
            console.log(`[CS2 Float] Exchange rate: 1 CNY = $${this.exchangeRate.toFixed(4)} USD`);
        } catch (error) {
            console.error('[CS2 Float] Error fetching exchange rate:', error);
            // Fallback exchange rate (approximate)
            this.exchangeRate = 0.14;
        }
    }

    /**
     * Fetch Buff163 price for an item
     * @param {string} itemName - Steam market name
     * @returns {Object|null} Price data
     */
    async fetchBuff163Price(itemName) {
        // Check cache first
        const cached = this.priceCache.get(itemName);
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            return cached.data;
        }

        // Check if request is already pending
        if (this.pendingRequests.has(itemName)) {
            return this.pendingRequests.get(itemName);
        }

        // Create new request
        const requestPromise = this._fetchFromBuff163(itemName);
        this.pendingRequests.set(itemName, requestPromise);

        try {
            const data = await requestPromise;

            // Cache result
            this.priceCache.set(itemName, {
                data: data,
                timestamp: Date.now()
            });

            return data;
        } finally {
            this.pendingRequests.delete(itemName);
        }
    }

    /**
     * Internal method to fetch from Buff163 API
     * @private
     */
    async _fetchFromBuff163(itemName) {
        try {
            // Note: Buff163 API requires authentication and has CORS restrictions
            // This is a simplified version - in production, use your proxy server

            // Try proxy endpoint first
            const response = await fetch(`${this.proxyUrl}?search=${encodeURIComponent(itemName)}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Buff163 API error: ${response.status}`);
            }

            const data = await response.json();

            if (data.success && data.items && data.items.length > 0) {
                const item = data.items[0];

                return {
                    itemName: item.market_hash_name || itemName,
                    priceCNY: parseFloat(item.sell_min_price || 0),
                    priceUSD: parseFloat(item.sell_min_price || 0) * this.exchangeRate,
                    volume: parseInt(item.sell_num || 0),
                    url: `https://buff.163.com/goods/${item.id}`,
                    available: true
                };
            }

            return null;

        } catch (error) {
            console.error('[CS2 Float] Error fetching Buff163 price:', error);

            // Return mock data for development/testing
            return this._getMockPrice(itemName);
        }
    }

    /**
     * Get mock price data for testing
     * @private
     */
    _getMockPrice(itemName) {
        // Generate mock price based on item name hash
        const hash = itemName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const mockPriceCNY = 10 + (hash % 500);
        const mockPriceUSD = mockPriceCNY * this.exchangeRate;

        return {
            itemName: itemName,
            priceCNY: mockPriceCNY,
            priceUSD: mockPriceUSD,
            volume: Math.floor(10 + (hash % 100)),
            url: 'https://buff.163.com',
            available: true,
            isMock: true // Mark as mock data
        };
    }

    /**
     * Calculate arbitrage opportunity
     * @param {number} steamPrice - Steam Market price in USD
     * @param {number} buffPrice - Buff163 price in USD
     * @returns {Object} Arbitrage data
     */
    calculateArbitrage(steamPrice, buffPrice) {
        const difference = steamPrice - buffPrice;
        const percentage = ((difference / buffPrice) * 100).toFixed(2);

        return {
            difference: difference,
            percentage: percentage,
            profitable: difference > 0,
            worthIt: difference > 1 && parseFloat(percentage) > 10 // At least $1 and 10% profit
        };
    }

    /**
     * Display Buff163 price for a market listing
     * @param {HTMLElement} listingElement - Market listing row
     * @param {string} itemName - Item name
     * @param {number} steamPrice - Steam Market price
     */
    async displayBuff163Price(listingElement, itemName, steamPrice) {
        if (!this.enabled) {
            return;
        }

        // Check if already processed
        if (listingElement.querySelector('.buff163-price-display')) {
            return;
        }

        // Fetch Buff163 price
        const buffData = await this.fetchBuff163Price(itemName);

        if (!buffData || !buffData.available) {
            return;
        }

        // Calculate arbitrage
        const arbitrage = this.calculateArbitrage(steamPrice, buffData.priceUSD);

        // Create price display
        const priceDisplay = this.createPriceDisplay(buffData, steamPrice, arbitrage);

        // Find appropriate container
        const priceContainer = listingElement.querySelector('.market_listing_price');
        if (priceContainer) {
            priceContainer.appendChild(priceDisplay);
        }
    }

    /**
     * Create price display HTML element
     */
    createPriceDisplay(buffData, steamPrice, arbitrage) {
        const container = document.createElement('div');
        container.className = 'buff163-price-display';

        // Determine badge class based on profit
        let badgeClass = 'neutral';
        if (arbitrage.worthIt) {
            badgeClass = 'high-profit';
        } else if (arbitrage.profitable) {
            badgeClass = 'low-profit';
        } else {
            badgeClass = 'loss';
        }

        container.innerHTML = `
            <div class="buff163-header">
                <img src="https://buff.163.com/favicon.ico" alt="Buff163" class="buff163-icon">
                <span class="buff163-label">Buff163</span>
                ${buffData.isMock ? '<span class="mock-badge" title="Mock data - connect to real API">DEMO</span>' : ''}
            </div>

            <div class="buff163-price-row">
                <span class="buff163-price">¥${buffData.priceCNY.toFixed(2)}</span>
                <span class="buff163-price-usd">($${buffData.priceUSD.toFixed(2)})</span>
            </div>

            <div class="buff163-arbitrage ${badgeClass}">
                <span class="arbitrage-icon">${arbitrage.profitable ? '📈' : '📉'}</span>
                <span class="arbitrage-text">
                    ${arbitrage.profitable ? '+' : ''}$${Math.abs(arbitrage.difference).toFixed(2)}
                    (${arbitrage.profitable ? '+' : ''}${arbitrage.percentage}%)
                </span>
            </div>

            ${arbitrage.worthIt ? `
                <div class="buff163-alert">
                    <span class="alert-icon">⚠️</span>
                    <span class="alert-text">Profitable arbitrage!</span>
                </div>
            ` : ''}

            <div class="buff163-footer">
                <a href="${buffData.url}" target="_blank" rel="noopener noreferrer" class="buff163-link">
                    View on Buff163 →
                </a>
                <span class="buff163-volume">${buffData.volume} available</span>
            </div>
        `;

        // Add click handler to open Buff163
        const link = container.querySelector('.buff163-link');
        link.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        return container;
    }

    /**
     * Inject CSS styles
     */
    injectCSS() {
        if (document.getElementById('buff163-integration-styles')) {
            return;
        }

        const style = document.createElement('style');
        style.id = 'buff163-integration-styles';
        style.textContent = `
            .buff163-price-display {
                margin-top: 8px;
                padding: 10px;
                background: linear-gradient(135deg, rgba(255, 107, 107, 0.1) 0%, rgba(255, 107, 107, 0.05) 100%);
                border: 1px solid rgba(255, 107, 107, 0.3);
                border-radius: 6px;
                font-size: 11px;
            }

            .buff163-header {
                display: flex;
                align-items: center;
                gap: 6px;
                margin-bottom: 6px;
            }

            .buff163-icon {
                width: 14px;
                height: 14px;
            }

            .buff163-label {
                font-weight: 600;
                color: #ff6b6b;
                font-size: 11px;
            }

            .mock-badge {
                background: rgba(251, 191, 36, 0.2);
                color: #fbbf24;
                padding: 2px 6px;
                border-radius: 3px;
                font-size: 9px;
                font-weight: 600;
                border: 1px solid rgba(251, 191, 36, 0.3);
            }

            .buff163-price-row {
                display: flex;
                align-items: center;
                gap: 8px;
                margin-bottom: 6px;
            }

            .buff163-price {
                font-weight: 700;
                color: #ff6b6b;
                font-size: 13px;
            }

            .buff163-price-usd {
                color: #a1a1aa;
                font-size: 11px;
            }

            .buff163-arbitrage {
                display: flex;
                align-items: center;
                gap: 6px;
                padding: 4px 8px;
                border-radius: 4px;
                margin-bottom: 6px;
                font-weight: 600;
                font-size: 11px;
            }

            .buff163-arbitrage.high-profit {
                background: rgba(34, 197, 94, 0.15);
                color: #22c55e;
                border: 1px solid rgba(34, 197, 94, 0.3);
            }

            .buff163-arbitrage.low-profit {
                background: rgba(251, 191, 36, 0.15);
                color: #fbbf24;
                border: 1px solid rgba(251, 191, 36, 0.3);
            }

            .buff163-arbitrage.loss {
                background: rgba(239, 68, 68, 0.15);
                color: #ef4444;
                border: 1px solid rgba(239, 68, 68, 0.3);
            }

            .arbitrage-icon {
                font-size: 12px;
            }

            .buff163-alert {
                display: flex;
                align-items: center;
                gap: 6px;
                padding: 4px 8px;
                background: rgba(34, 197, 94, 0.2);
                border: 1px solid rgba(34, 197, 94, 0.4);
                border-radius: 4px;
                margin-bottom: 6px;
                font-weight: 600;
                font-size: 11px;
                color: #22c55e;
                animation: buff163-pulse 2s infinite;
            }

            @keyframes buff163-pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.7; }
            }

            .alert-icon {
                font-size: 12px;
            }

            .buff163-footer {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding-top: 6px;
                border-top: 1px solid rgba(255, 107, 107, 0.2);
            }

            .buff163-link {
                color: #ff6b6b;
                text-decoration: none;
                font-weight: 600;
                font-size: 11px;
                transition: color 0.2s;
            }

            .buff163-link:hover {
                color: #ff5252;
                text-decoration: underline;
            }

            .buff163-volume {
                color: #a1a1aa;
                font-size: 10px;
            }

            /* Mobile responsive */
            @media (max-width: 768px) {
                .buff163-price-display {
                    padding: 8px;
                }

                .buff163-footer {
                    flex-direction: column;
                    align-items: flex-start;
                    gap: 4px;
                }
            }
        `;

        document.head.appendChild(style);
    }

    /**
     * Enable Buff163 integration
     */
    enable() {
        this.enabled = true;
        console.log('[CS2 Float] Buff163 integration enabled');
    }

    /**
     * Disable Buff163 integration
     */
    disable() {
        this.enabled = false;
        console.log('[CS2 Float] Buff163 integration disabled');
    }

    /**
     * Clear price cache
     */
    clearCache() {
        this.priceCache.clear();
        console.log('[CS2 Float] Buff163 price cache cleared');
    }
}

// Initialize on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.buff163Integration = new Buff163Integration();
    });
} else {
    window.buff163Integration = new Buff163Integration();
}

// Make available globally
if (typeof window !== 'undefined') {
    window.Buff163Integration = Buff163Integration;
}
