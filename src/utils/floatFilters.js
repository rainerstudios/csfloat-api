/**
 * Float Filters Module
 * Adds Min Float, Max Float, Sort by Float, and Reset Filter controls to market listing pages
 */

export class FloatFilters {
    constructor() {
        this.initialized = false;
        this.settings = {};
        this.currentFilters = {
            minFloat: 0.0,
            maxFloat: 1.0,
            sortBy: 'none' // none, asc, desc
        };
        this.originalListings = [];
        this.filteredListings = [];
    }

    log(...args) {
        console.log('[Float Filters]', ...args);
    }

    async init() {
        if (this.initialized) return;

        this.log('Initializing float filters...');
        await this.loadSettings();

        if (this.isMarketListingPage()) {
            this.addFloatFilterControls();
            this.collectOriginalListings();
            this.setupListingObserver();
            this.initialized = true;
            this.log('Float filters initialized successfully');
        }
    }

    async loadSettings() {
        // Settings will be passed from content script via postMessage
        // No direct chrome.storage access in injected context
        this.log('Settings will be provided by content script');
    }

    isMarketListingPage() {
        const url = window.location.href;
        return url.includes('/market/listings/') && !url.includes('/market/search');
    }

    addFloatFilterControls() {
        // Find the location to insert filter controls (right after currency swapper if it exists)
        const insertLocation = this.findInsertLocation();
        if (!insertLocation) {
            this.log('Could not find suitable location for filter controls');
            setTimeout(() => this.addFloatFilterControls(), 1000);
            return;
        }

        const existingControls = document.querySelector('#cs2-float-filter-controls');
        if (existingControls) {
            this.log('Float filter controls already exist');
            return;
        }

        this.log('Adding float filter controls...');

        const controlsContainer = document.createElement('div');
        controlsContainer.id = 'cs2-float-filter-controls';
        controlsContainer.style.cssText = `
            margin: 10px 0;
            padding: 12px 16px;
            background: rgba(42, 71, 94, 0.2);
            border: 1px solid rgba(102, 192, 244, 0.3);
            border-radius: 4px;
            display: flex;
            align-items: center;
            gap: 16px;
            font-family: "Motiva Sans", Sans-serif;
            flex-wrap: wrap;
        `;

        // Min Float Input
        const minFloatGroup = this.createInputGroup('Min Float:', 'minFloat', '0.0', '0', '1', '0.001');
        
        // Max Float Input  
        const maxFloatGroup = this.createInputGroup('Max Float:', 'maxFloat', '1.0', '0', '1', '0.001');

        // Sort by Float Dropdown
        const sortGroup = document.createElement('div');
        sortGroup.style.cssText = 'display: flex; align-items: center; gap: 8px;';
        
        const sortLabel = document.createElement('span');
        sortLabel.textContent = 'Sort by Float:';
        sortLabel.style.cssText = `
            color: #c6d4df;
            font-size: 13px;
            font-weight: 500;
            white-space: nowrap;
        `;

        const sortSelect = document.createElement('select');
        sortSelect.id = 'cs2-float-sort';
        sortSelect.style.cssText = `
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

        const sortOptions = [
            { value: 'none', text: 'Default' },
            { value: 'asc', text: 'Low to High ↑' },
            { value: 'desc', text: 'High to Low ↓' }
        ];

        sortOptions.forEach(option => {
            const optionElement = document.createElement('option');
            optionElement.value = option.value;
            optionElement.textContent = option.text;
            sortSelect.appendChild(optionElement);
        });

        sortGroup.appendChild(sortLabel);
        sortGroup.appendChild(sortSelect);

        // Reset Filter Button
        const resetButton = document.createElement('button');
        resetButton.id = 'cs2-reset-filters';
        resetButton.textContent = 'Reset Filter';
        resetButton.style.cssText = `
            background: linear-gradient(to bottom, #75b022 5%, #68a54b 100%);
            border: 1px solid #4e7a0d;
            border-radius: 3px;
            color: #ffffff;
            cursor: pointer;
            font-size: 12px;
            font-weight: bold;
            padding: 6px 12px;
            text-decoration: none;
            font-family: "Motiva Sans", Sans-serif;
            transition: all 0.2s ease;
        `;

        // Add hover effects
        [minFloatGroup.querySelector('input'), maxFloatGroup.querySelector('input'), sortSelect].forEach(element => {
            element.addEventListener('mouseenter', () => {
                element.style.backgroundColor = '#4a5563';
                element.style.borderColor = '#ffffff';
            });

            element.addEventListener('mouseleave', () => {
                element.style.backgroundColor = '#3d4450';
                element.style.borderColor = '#66c0f4';
            });
        });

        resetButton.addEventListener('mouseenter', () => {
            resetButton.style.background = 'linear-gradient(to bottom, #68a54b 5%, #75b022 100%)';
        });

        resetButton.addEventListener('mouseleave', () => {
            resetButton.style.background = 'linear-gradient(to bottom, #75b022 5%, #68a54b 100%)';
        });

        // Add event listeners
        minFloatGroup.querySelector('input').addEventListener('input', () => this.applyFilters());
        maxFloatGroup.querySelector('input').addEventListener('input', () => this.applyFilters());
        sortSelect.addEventListener('change', () => this.applyFilters());
        resetButton.addEventListener('click', () => this.resetFilters());

        // Assemble the container
        controlsContainer.appendChild(minFloatGroup);
        controlsContainer.appendChild(maxFloatGroup);
        controlsContainer.appendChild(sortGroup);
        controlsContainer.appendChild(resetButton);

        // Insert the controls
        insertLocation.insertAdjacentElement('afterend', controlsContainer);

        this.log('Float filter controls added successfully');
    }

    createInputGroup(labelText, id, defaultValue, min, max, step) {
        const group = document.createElement('div');
        group.style.cssText = 'display: flex; align-items: center; gap: 8px;';

        const label = document.createElement('span');
        label.textContent = labelText;
        label.style.cssText = `
            color: #c6d4df;
            font-size: 13px;
            font-weight: 500;
            white-space: nowrap;
        `;

        const input = document.createElement('input');
        input.type = 'number';
        input.id = `cs2-${id}`;
        input.value = defaultValue;
        input.min = min;
        input.max = max;
        input.step = step;
        input.style.cssText = `
            background-color: #3d4450;
            color: #c6d4df;
            border: 1px solid #66c0f4;
            border-radius: 3px;
            padding: 4px 8px;
            font-size: 12px;
            font-family: "Motiva Sans", Sans-serif;
            width: 80px;
            outline: none;
            transition: all 0.2s ease;
        `;

        group.appendChild(label);
        group.appendChild(input);
        return group;
    }

    findInsertLocation() {
        // Try to find currency swapper first
        const currencySwapper = document.querySelector('#cs2-currency-selector-container');
        if (currencySwapper) {
            return currencySwapper;
        }

        // Try to find market buy requests
        const buyRequests = document.querySelector('#market_commodity_buyrequests');
        if (buyRequests) {
            return buyRequests;
        }

        // Try other market sections
        const selectors = [
            '.market_commodity_order_block',
            '#market_commodity_order_spread',
            '.market_listing_header'
        ];

        for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (element) {
                return element;
            }
        }

        return null;
    }

    collectOriginalListings() {
        // Wait for listings to load and try multiple selectors
        setTimeout(() => {
            const selectors = [
                '.market_listing_row',
                '.market_listing_row_link', 
                '.market_recent_listing_row',
                '#searchResultsRows .market_listing_row',
                '.market_listing_table .market_listing_row'
            ];
            
            let listings = [];
            for (const selector of selectors) {
                const found = document.querySelectorAll(selector);
                if (found.length > 0) {
                    listings = Array.from(found);
                    this.log(`Found ${listings.length} listings using selector: ${selector}`);
                    break;
                }
            }
            
            if (listings.length === 0) {
                this.log('No market listings found, retrying in 2s...');
                setTimeout(() => this.collectOriginalListings(), 2000);
                return;
            }
            
            this.originalListings = listings;
            this.filteredListings = [...this.originalListings];
            this.log(`Collected ${this.originalListings.length} market listings`);
        }, 1000);
    }

    applyFilters() {
        const minFloat = parseFloat(document.getElementById('cs2-minFloat')?.value || '0');
        const maxFloat = parseFloat(document.getElementById('cs2-maxFloat')?.value || '1');
        const sortBy = document.getElementById('cs2-float-sort')?.value || 'none';

        this.currentFilters = { minFloat, maxFloat, sortBy };
        this.log('Applying filters:', this.currentFilters);

        // Filter listings based on float values
        this.filteredListings = this.originalListings.filter(listing => {
            // Look for float data in various places
            const floatElement = listing.querySelector('[data-float-value], .cs2-float-display, .float-value');
            if (!floatElement) {
                this.log('No float element found in listing');
                return true; // Show if no float data
            }

            let floatValue = null;
            
            // Try data attribute first
            if (floatElement.dataset && floatElement.dataset.floatValue) {
                floatValue = parseFloat(floatElement.dataset.floatValue);
            }
            // Try text content
            else if (floatElement.textContent) {
                const floatMatch = floatElement.textContent.match(/\d+\.\d+/);
                if (floatMatch) {
                    floatValue = parseFloat(floatMatch[0]);
                }
            }
            
            if (floatValue === null || isNaN(floatValue)) {
                this.log('No valid float value found');
                return true;
            }

            const inRange = floatValue >= minFloat && floatValue <= maxFloat;
            this.log(`Float ${floatValue} in range ${minFloat}-${maxFloat}:`, inRange);
            return inRange;
        });

        // Sort listings if requested
        if (sortBy !== 'none') {
            this.filteredListings.sort((a, b) => {
                const getFloatValue = (listing) => {
                    const floatElement = listing.querySelector('[data-float-value], .cs2-float-display, .float-value');
                    if (floatElement?.dataset?.floatValue) {
                        return parseFloat(floatElement.dataset.floatValue);
                    }
                    if (floatElement?.textContent) {
                        const match = floatElement.textContent.match(/\d+\.\d+/);
                        return match ? parseFloat(match[0]) : 0;
                    }
                    return 0;
                };

                const floatA = getFloatValue(a);
                const floatB = getFloatValue(b);

                if (sortBy === 'asc') return floatA - floatB;
                if (sortBy === 'desc') return floatB - floatA;
                return 0;
            });
        }

        this.updateListingDisplay();
    }

    updateListingDisplay() {
        this.log(`Updating display: showing ${this.filteredListings.length} of ${this.originalListings.length} listings`);
        
        // Find the listings container that holds all the individual listing rows
        const listingsContainer = document.querySelector('#searchResultsRows, .market_listing_table tbody, .market_listing_table');
        
        if (!listingsContainer) {
            this.log('Could not find listings container');
            return;
        }

        // Clear the container first
        const existingListings = listingsContainer.querySelectorAll('.market_listing_row');
        existingListings.forEach(listing => {
            listing.remove();
        });

        // Add filtered listings in the correct order
        this.filteredListings.forEach((listing, index) => {
            // Clone the listing to avoid moving the original DOM element
            const listingClone = listing.cloneNode(true);
            listingsContainer.appendChild(listingClone);
        });

        this.log(`Display updated: ${this.filteredListings.length} listings added to container`);
    }

    resetFilters() {
        this.log('Resetting filters');
        
        // Reset form values
        const minFloatInput = document.getElementById('cs2-minFloat');
        const maxFloatInput = document.getElementById('cs2-maxFloat');
        const sortSelect = document.getElementById('cs2-float-sort');

        if (minFloatInput) minFloatInput.value = '0.0';
        if (maxFloatInput) maxFloatInput.value = '1.0';
        if (sortSelect) sortSelect.value = 'none';

        // Reset internal state
        this.currentFilters = {
            minFloat: 0.0,
            maxFloat: 1.0,
            sortBy: 'none'
        };

        // Restore original listing order and visibility
        this.filteredListings = [...this.originalListings];
        this.updateListingDisplay();
    }

    setupListingObserver() {
        // Watch for new listings being added dynamically
        const observer = new MutationObserver((mutations) => {
            let hasNewListings = false;
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        const newListings = node.querySelectorAll ? 
                            node.querySelectorAll('.market_listing_row_link') : [];
                        
                        if (newListings.length > 0) {
                            hasNewListings = true;
                            newListings.forEach(listing => {
                                if (!this.originalListings.includes(listing)) {
                                    this.originalListings.push(listing);
                                }
                            });
                        }
                    }
                });
            });

            if (hasNewListings) {
                this.log('New listings detected, reapplying filters');
                setTimeout(() => this.applyFilters(), 500);
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        this.observer = observer;
    }

    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
    }

    destroy() {
        const controls = document.querySelector('#cs2-float-filter-controls');
        if (controls) {
            controls.remove();
        }
        
        if (this.observer) {
            this.observer.disconnect();
        }
        
        this.initialized = false;
    }
}

// Export singleton instance
export const floatFilters = new FloatFilters();