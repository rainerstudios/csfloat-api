/**
 * Currency Hot-Swapper Module
 * Adds currency switching capabilities to Steam Market pages
 */

export class CurrencySwapper {
    constructor() {
        this.initialized = false;
        this.settings = {};
        
        // Steam Currency mapping (all 41 supported currencies)
        this.currencies = {
            1: 'USD', 2: 'GBP', 3: 'EUR', 4: 'CHF', 5: 'RUB', 6: 'PLN', 7: 'BRL',
            8: 'NOK', 9: 'SEK', 10: 'IDR', 11: 'MYR', 12: 'PHP', 13: 'SGD',
            14: 'THB', 15: 'VND', 16: 'KRW', 17: 'TRY', 18: 'UAH', 19: 'MXN',
            20: 'CAD', 21: 'AUD', 22: 'NZD', 23: 'CNY', 24: 'INR', 25: 'CLP',
            26: 'PEN', 27: 'COP', 28: 'ZAR', 29: 'HKD', 30: 'TWD', 31: 'SAR',
            32: 'AED', 34: 'ARS', 35: 'ILS', 37: 'KZT', 38: 'KWD', 39: 'QAR',
            40: 'CRC', 41: 'UYU'
        };

        // Currency symbols for display
        this.currencySymbols = {
            'USD': '$', 'EUR': '€', 'GBP': '£', 'JPY': '¥',
            'CNY': '¥', 'RUB': '₽', 'BRL': 'R$', 'CAD': 'C$',
            'AUD': 'A$', 'CHF': 'Fr', 'SEK': 'kr', 'NOK': 'kr',
            'PLN': 'zł', 'TRY': '₺', 'INR': '₹', 'KRW': '₩',
            'MXN': '$', 'ZAR': 'R', 'HKD': 'HK$', 'SGD': 'S$'
        };
    }

    log(...args) {
        console.log('[Currency Swapper]', ...args);
    }

    async init() {
        if (this.initialized) return;

        this.log('Initializing currency swapper...');
        await this.loadSettings();

        if (this.isMarketPage()) {
            this.addCurrencySelector();
            this.initialized = true;
            this.log('Currency swapper initialized successfully');
        }
    }

    async loadSettings() {
        // Settings will be passed from content script via postMessage
        // No direct chrome.storage access in injected context
        this.log('Settings will be provided by content script');
    }

    isMarketPage() {
        const url = window.location.href;
        return url.includes('/market/listings/') || 
               url.includes('/market/search') || 
               url.includes('/market/');
    }

    addCurrencySelector() {
        // Wait for DOM to be ready
        setTimeout(() => {
            // Find appropriate location for currency selector
            const marketHeader = this.findMarketHeader();
            if (!marketHeader) {
                this.log('Market header not found, retrying in 2s...');
                setTimeout(() => this.addCurrencySelector(), 2000);
                return;
            }

            const existingSelector = document.querySelector('#cs2-currency-selector-container');
        if (existingSelector) {
            this.log('Currency selector already exists');
            return;
        }

        this.log('Adding currency selector...');

        const selectorContainer = document.createElement('div');
        selectorContainer.id = 'cs2-currency-selector-container';
        selectorContainer.style.cssText = `
            margin: 10px 0;
            padding: 12px 16px;
            background: rgba(42, 71, 94, 0.2);
            border: 1px solid rgba(102, 192, 244, 0.3);
            border-radius: 4px;
            display: flex;
            align-items: center;
            gap: 12px;
            font-family: "Motiva Sans", Sans-serif;
        `;

        // Currency icon
        const currencyIcon = document.createElement('div');
        currencyIcon.innerHTML = '💱';
        currencyIcon.style.cssText = `
            font-size: 16px;
            width: 20px;
            text-align: center;
        `;

        const label = document.createElement('span');
        label.textContent = 'Currency: ';
        label.style.cssText = `
            color: #c6d4df;
            font-size: 13px;
            font-weight: 500;
        `;

        const selector = document.createElement('select');
        selector.id = 'cs2-currency-selector';
        selector.style.cssText = `
            background-color: #3d4450;
            color: #c6d4df;
            border: 1px solid #66c0f4;
            border-radius: 3px;
            padding: 6px 8px;
            font-size: 12px;
            font-family: "Motiva Sans", Sans-serif;
            cursor: pointer;
            outline: none;
            transition: all 0.2s ease;
        `;

        // Add hover effects
        selector.addEventListener('mouseenter', () => {
            selector.style.backgroundColor = '#4a5563';
            selector.style.borderColor = '#ffffff';
        });

        selector.addEventListener('mouseleave', () => {
            selector.style.backgroundColor = '#3d4450';
            selector.style.borderColor = '#66c0f4';
        });

        // Populate currency options
        Object.entries(this.currencies).forEach(([id, code]) => {
            const option = document.createElement('option');
            option.value = id;
            const symbol = this.currencySymbols[code] || code;
            option.textContent = `${symbol} ${code}`;
            selector.appendChild(option);
        });

        // Set current currency if available
        const currentCurrency = this.getCurrentCurrency();
        if (currentCurrency) {
            selector.value = currentCurrency;
            this.log(`Current currency detected: ${this.currencies[currentCurrency]}`);
        }

        // Add change event listener
        selector.addEventListener('change', (e) => {
            const newCurrencyId = e.target.value;
            const currencyCode = this.currencies[newCurrencyId];
            this.log(`Switching to currency: ${currencyCode} (${newCurrencyId})`);
            this.changeCurrency(newCurrencyId);
        });

        // Status indicator
        const statusIndicator = document.createElement('span');
        statusIndicator.style.cssText = `
            color: #90ba3c;
            font-size: 11px;
            margin-left: auto;
        `;
        statusIndicator.textContent = 'Hot-swap enabled';

        // Assemble the container
        selectorContainer.appendChild(currencyIcon);
        selectorContainer.appendChild(label);
        selectorContainer.appendChild(selector);
        selectorContainer.appendChild(statusIndicator);

        // Insert after the market header (buy requests section)
        if (marketHeader.id === 'market_commodity_buyrequests') {
            // Insert after the buy requests section
            marketHeader.insertAdjacentElement('afterend', selectorContainer);
        } else {
            // Insert inside or after other market headers
            marketHeader.appendChild(selectorContainer);
        }

        this.log('Currency selector added successfully');
        }, 1000);
    }

    findMarketHeader() {
        // Try to find the market buy requests section first
        const buyRequestsSection = document.querySelector('#market_commodity_buyrequests');
        if (buyRequestsSection) {
            this.log('Found buy requests section, inserting after it');
            return buyRequestsSection;
        }

        // Try to find the "View more details" link area
        const viewMoreDetails = document.querySelector('.market_commodity_order_block');
        if (viewMoreDetails) {
            this.log('Found view more details section');
            return viewMoreDetails;
        }

        // Try multiple selectors for different Steam market page layouts
        const selectors = [
            '#market_commodity_order_spread',
            '.market_listing_nav', 
            '.market_commodity_order_block',
            '.market_listing_header',
            '#searchResultsTable',
            '.market_search_game_button_group'
        ];

        for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (element) {
                this.log(`Found market header: ${selector}`);
                return element;
            }
        }

        // Fallback: try to find any element that looks like a market container
        const marketContainers = document.querySelectorAll('[id*="market"], [class*="market"]');
        if (marketContainers.length > 0) {
            this.log(`Using fallback market container`);
            return marketContainers[0];
        }

        return null;
    }

    getCurrentCurrency() {
        // Try to detect current currency from various page elements
        const currencyElements = [
            '.market_listing_price_with_fee',
            '.market_listing_price',
            '.market_commodity_orders_header_promote',
            '[class*="currency"]'
        ];

        for (const selector of currencyElements) {
            const element = document.querySelector(selector);
            if (element) {
                const text = element.textContent || element.innerText || '';
                
                // Try to match currency symbols or codes
                for (const [id, code] of Object.entries(this.currencies)) {
                    const symbol = this.currencySymbols[code];
                    if ((symbol && text.includes(symbol)) || text.includes(code)) {
                        return id;
                    }
                }
            }
        }

        // Check URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const currencyParam = urlParams.get('currency');
        if (currencyParam && this.currencies[currencyParam]) {
            return currencyParam;
        }

        // Default to USD
        return '1';
    }

    getCurrencySymbol(currencyCode) {
        return this.currencySymbols[currencyCode] || currencyCode;
    }

    changeCurrency(newCurrencyId) {
        const currentUrl = new URL(window.location.href);
        currentUrl.searchParams.set('currency', newCurrencyId);
        
        const newCurrencyCode = this.currencies[newCurrencyId];
        const symbol = this.getCurrencySymbol(newCurrencyCode);
        
        this.log(`Changing currency to ${symbol} ${newCurrencyCode} (ID: ${newCurrencyId})`);
        
        // Show loading indicator
        const selector = document.querySelector('#cs2-currency-selector');
        if (selector) {
            selector.style.opacity = '0.6';
            selector.disabled = true;
        }

        // Navigate to new URL with currency parameter
        window.location.href = currentUrl.toString();
    }

    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        
        // Re-initialize if needed
        if (!this.initialized && this.isMarketPage()) {
            this.init();
        }
    }

    destroy() {
        const container = document.querySelector('#cs2-currency-selector-container');
        if (container) {
            container.remove();
        }
        this.initialized = false;
    }
}

// Export singleton instance
export const currencySwapper = new CurrencySwapper();