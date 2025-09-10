/**
 * Float Filter and Sorter Component
 * Provides Min Float, Max Float filtering and Sort by Float functionality
 */

export class FloatSorter {
    constructor() {
        this.sortDirection = 'none'; // none, asc, desc
        this.minFloatValue = '';
        this.maxFloatValue = '';
        this.sortButton = null;
        this.resetButton = null;
        this.observer = null;
        this.debounceTimer = null;
        this.container = null;
        
        this.init();
    }
    
    init() {
        // Only show filters on individual CS2 item listing pages, not search pages
        if (!this.isValidPageForFilters()) {
            console.log('[FloatSorter] Skipping filter creation - not a valid page');
            return;
        }
        
        this.createFilterInterface();
        this.setupEventListeners();
        this.initMutationObserver();
        
        // Auto-filter when float values change
        setInterval(() => {
            if (this.minFloatValue || this.maxFloatValue) {
                this.filterItems();
            }
        }, 1000);
    }
    
    isValidPageForFilters() {
        const url = window.location.href;
        // Only show on individual item listing pages, not search pages
        return url.includes('/market/listings/') && !url.includes('/market/search');
    }
    
    createFilterInterface() {
        // Remove any existing old filter controls first
        this.removeOldFilters();
        
        // Create container
        this.container = document.createElement('div');
        this.container.id = 'cs2-float-filter';
        this.container.innerHTML = `
            <style>
                #cs2-float-filter {
                    margin: 15px 0;
                    display: flex;
                    align-items: center;
                    flex-wrap: wrap;
                    gap: 12px;
                    background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
                    padding: 15px;
                    border-radius: 8px;
                    border: 1px solid #3a3a3a;
                    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                }
                
                #cs2-float-filter label {
                    margin-right: 8px;
                    font-weight: 600;
                    color: #e0e0e0;
                    font-size: 14px;
                }
                
                #cs2-float-filter input[type="text"] {
                    padding: 8px 12px;
                    border: 1px solid #4a4a4a;
                    border-radius: 6px;
                    background: #3a3a3a;
                    color: #e0e0e0;
                    width: 80px;
                    font-size: 14px;
                    transition: all 0.2s ease;
                }
                
                #cs2-float-filter input[type="text"]:focus {
                    outline: none;
                    border-color: #22c55e;
                    background: #4a4a4a;
                    box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.2);
                }
                
                #cs2-float-filter input[type="text"]::placeholder {
                    color: #888;
                }
                
                #cs2-float-filter button {
                    padding: 8px 16px;
                    border: none;
                    border-radius: 6px;
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    user-select: none;
                }
                
                #cs2-float-filter #cs2-sort-button {
                    background: #22c55e;
                    color: #1a1a1a;
                }
                
                #cs2-float-filter #cs2-sort-button:hover {
                    background: #16a34a;
                    transform: translateY(-1px);
                }
                
                #cs2-float-filter #cs2-reset-button {
                    background: #6b7280;
                    color: #e0e0e0;
                }
                
                #cs2-float-filter #cs2-reset-button:hover {
                    background: #4b5563;
                    transform: translateY(-1px);
                }
                
                #cs2-float-filter .filter-stats {
                    margin-left: auto;
                    color: #888;
                    font-size: 12px;
                    padding: 4px 8px;
                    background: rgba(255, 255, 255, 0.05);
                    border-radius: 4px;
                }
            </style>
            
            <label for="cs2-min-float">Min Float:</label>
            <input type="text" id="cs2-min-float" placeholder="0.0" />
            
            <label for="cs2-max-float">Max Float:</label>
            <input type="text" id="cs2-max-float" placeholder="1.0" />
            
            <button id="cs2-sort-button">Sort by Float</button>
            <button id="cs2-reset-button">Reset Filter</button>
            
            <div class="filter-stats" id="cs2-filter-stats"></div>
        `;
        
        // Insert into page
        const searchResults = document.querySelector('#searchResultsRows, .market_listing_table');
        if (searchResults && searchResults.parentNode) {
            searchResults.parentNode.insertBefore(this.container, searchResults);
        }
    }
    
    setupEventListeners() {
        const minFloatInput = this.container.querySelector('#cs2-min-float');
        const maxFloatInput = this.container.querySelector('#cs2-max-float');
        this.sortButton = this.container.querySelector('#cs2-sort-button');
        this.resetButton = this.container.querySelector('#cs2-reset-button');
        
        minFloatInput.addEventListener('input', (e) => {
            this.minFloatValue = e.target.value.trim();
            this.filterItems();
        });
        
        maxFloatInput.addEventListener('input', (e) => {
            this.maxFloatValue = e.target.value.trim();
            this.filterItems();
        });
        
        this.sortButton.addEventListener('click', this.toggleSort.bind(this));
        this.resetButton.addEventListener('click', this.resetFilter.bind(this));
    }
    
    initMutationObserver() {
        const searchResults = document.querySelector('#searchResultsRows, .market_listing_table');
        if (!searchResults) return;
        
        const options = {
            childList: true,
            subtree: false
        };
        
        this.observer = new MutationObserver((mutations) => {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = setTimeout(() => {
                this.filterItems();
            }, 100);
        });
        
        this.observer.observe(searchResults, options);
    }
    
    getFloatValue(listingElement) {
        // Try different selectors for our float data
        const selectors = [
            '.cs2-float-display',
            '[data-float-value]',
            '[data-float]',
            '.float-value',
            '.market_float_display'
        ];
        
        for (const selector of selectors) {
            const floatElement = listingElement.querySelector(selector);
            if (floatElement) {
                // Try data attributes first
                let floatValue = floatElement.getAttribute('data-float-value') || 
                               floatElement.getAttribute('data-float');
                if (floatValue) return floatValue;
                
                // Try text content with various patterns
                const textContent = floatElement.textContent || floatElement.innerText;
                
                // Look for our "Float: X.XXXXXX" format
                let floatMatch = textContent.match(/Float:\s*(\d+\.\d+)/i);
                if (floatMatch) return floatMatch[1];
                
                // Look for standalone float numbers
                floatMatch = textContent.match(/(\d+\.\d{6,})/);
                if (floatMatch) return floatMatch[1];
                
                // Look for any decimal number
                floatMatch = textContent.match(/(\d+\.\d+)/);
                if (floatMatch) return floatMatch[1];
            }
        }
        
        // Fallback: search entire listing for float pattern
        const fullText = listingElement.textContent || listingElement.innerText;
        const floatPatterns = [
            /Float:\s*(\d+\.\d+)/i,
            /(\d+\.\d{6,})/,
            /Float.*?(\d+\.\d+)/i
        ];
        
        for (const pattern of floatPatterns) {
            const floatMatch = fullText.match(pattern);
            if (floatMatch) return floatMatch[1];
        }
        
        return null;
    }
    
    filterItems() {
        const listings = document.querySelectorAll('.market_listing_row');
        const minFloat = parseFloat(this.minFloatValue) || 0;
        const maxFloat = parseFloat(this.maxFloatValue) || 1;
        
        let visibleCount = 0;
        let totalCount = 0;
        
        listings.forEach(listing => {
            totalCount++;
            const floatValue = this.getFloatValue(listing);
            
            if (!floatValue) {
                // Show items without float data by default
                listing.style.display = '';
                visibleCount++;
                return;
            }
            
            const floatNum = parseFloat(floatValue);
            if (isNaN(floatNum)) {
                listing.style.display = '';
                visibleCount++;
                return;
            }
            
            const isVisible = floatNum >= minFloat && floatNum <= maxFloat;
            listing.style.display = isVisible ? '' : 'none';
            
            if (isVisible) visibleCount++;
        });
        
        // Update stats
        this.updateFilterStats(visibleCount, totalCount);
    }
    
    sortItems() {
        const searchResults = document.querySelector('#searchResultsRows, .market_listing_table');
        if (!searchResults) return;
        
        const listings = Array.from(searchResults.querySelectorAll('.market_listing_row'));
        
        listings.sort((a, b) => {
            const floatA = this.getFloatValue(a);
            const floatB = this.getFloatValue(b);
            
            if (!floatA || !floatB) return 0;
            
            const numA = parseFloat(floatA);
            const numB = parseFloat(floatB);
            
            if (isNaN(numA) || isNaN(numB)) return 0;
            
            if (this.sortDirection === 'asc') {
                return numA - numB;
            } else {
                return numB - numA;
            }
        });
        
        // Reorder DOM elements
        listings.forEach(listing => searchResults.appendChild(listing));
    }
    
    toggleSort() {
        if (this.sortDirection === 'none' || this.sortDirection === 'desc') {
            this.sortDirection = 'asc';
        } else {
            this.sortDirection = 'desc';
        }
        
        this.updateSortButtonText();
        this.sortItems();
    }
    
    updateSortButtonText() {
        let text = 'Sort by Float';
        if (this.sortDirection === 'asc') {
            text += ' ▲';
        } else if (this.sortDirection === 'desc') {
            text += ' ▼';
        }
        this.sortButton.textContent = text;
    }
    
    updateFilterStats(visible, total) {
        const statsElement = this.container.querySelector('#cs2-filter-stats');
        if (statsElement) {
            if (this.minFloatValue || this.maxFloatValue) {
                statsElement.textContent = `${visible}/${total} items shown`;
                statsElement.style.display = 'block';
            } else {
                statsElement.style.display = 'none';
            }
        }
    }
    
    resetFilter() {
        const searchResults = document.querySelector('#searchResultsRows, .market_listing_table');
        if (!searchResults) return;
        
        // Show all listings
        Array.from(searchResults.querySelectorAll('.market_listing_row')).forEach(listing => {
            listing.style.display = '';
        });
        
        // Clear inputs
        const minFloatInput = this.container.querySelector('#cs2-min-float');
        const maxFloatInput = this.container.querySelector('#cs2-max-float');
        
        minFloatInput.value = '';
        maxFloatInput.value = '';
        
        this.minFloatValue = '';
        this.maxFloatValue = '';
        this.sortDirection = 'none';
        
        this.updateSortButtonText();
        this.updateFilterStats(0, 0);
    }
    
    destroy() {
        if (this.observer) {
            this.observer.disconnect();
        }
        
        if (this.container) {
            this.container.remove();
        }
        
        clearTimeout(this.debounceTimer);
    }
    
    removeOldFilters() {
        // Remove old float filter controls that might conflict
        const oldFilters = [
            '#cs2-float-filter-controls',
            '.cs2-float-filter-controls',
            '[id*="float-filter"]',
            '[id*="minFloat"]',
            '[id*="maxFloat"]',
            '[id*="float-sort"]'
        ];
        
        oldFilters.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(element => {
                console.log(`[Float Sorter] Removing old filter element:`, element);
                element.remove();
            });
        });
        
        // Also remove any containers that might have been created by old filters
        const potentialContainers = document.querySelectorAll('div[style*="cs2-float-filter-controls"]');
        potentialContainers.forEach(container => {
            if (container.innerHTML.includes('Min Float:') || container.innerHTML.includes('Max Float:')) {
                console.log(`[Float Sorter] Removing old filter container:`, container);
                container.remove();
            }
        });
    }
}