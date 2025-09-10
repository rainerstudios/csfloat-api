/**
 * Advanced Float Filtering System
 * Provides comprehensive filtering for float values, patterns, stickers, and more
 * @version 1.0.0
 * @author CS2 Float Checker Team
 */

class FloatFilter {
    constructor() {
        this.activeFilters = {};
        this.savedPresets = {};
        this.filteredItems = new Set();
        this.allItems = new Map();
        this.filterPanel = null;
        
        this.initializeFilters();
    }

    /**
     * Initialize filter system
     */
    initializeFilters() {
        this.filterTypes = {
            float: {
                name: 'Float Range',
                type: 'range',
                min: 0,
                max: 1,
                step: 0.001,
                validate: (value) => value >= 0 && value <= 1
            },
            paintSeed: {
                name: 'Paint Seed',
                type: 'range',
                min: 1,
                max: 1000,
                step: 1,
                validate: (value) => value >= 1 && value <= 1000
            },
            pattern: {
                name: 'Pattern Type',
                type: 'select',
                options: [
                    { value: 'bluegem', label: 'Blue Gem' },
                    { value: 'doppler', label: 'Doppler' },
                    { value: 'fade', label: 'Fade' },
                    { value: 'marblefade', label: 'Marble Fade' },
                    { value: 'casehardened', label: 'Case Hardened' }
                ]
            },
            stickers: {
                name: 'Stickers',
                type: 'text',
                placeholder: 'Katowice, Titan, iBUYPOWER...',
                validate: (value) => typeof value === 'string'
            },
            priceRange: {
                name: 'Price Range ($)',
                type: 'range',
                min: 0,
                max: 10000,
                step: 0.01,
                validate: (value) => value >= 0
            },
            wear: {
                name: 'Wear Condition',
                type: 'multiselect',
                options: [
                    { value: 'fn', label: 'Factory New (0-0.07)' },
                    { value: 'mw', label: 'Minimal Wear (0.07-0.15)' },
                    { value: 'ft', label: 'Field-Tested (0.15-0.38)' },
                    { value: 'ww', label: 'Well-Worn (0.38-0.45)' },
                    { value: 'bs', label: 'Battle-Scarred (0.45-1.0)' }
                ]
            },
            tradable: {
                name: 'Tradability',
                type: 'select',
                options: [
                    { value: 'all', label: 'All Items' },
                    { value: 'tradable', label: 'Tradable Only' },
                    { value: 'locked', label: 'Trade Locked Only' }
                ]
            }
        };
    }

    /**
     * Create and inject filter panel into the page
     */
    createFilterPanel() {
        if (this.filterPanel) {
            return this.filterPanel;
        }

        const panel = document.createElement('div');
        panel.className = 'cs2-float-filter-panel';
        panel.innerHTML = `
            <div class="filter-panel-header">
                <h3>🔍 Advanced Filters</h3>
                <div class="filter-controls">
                    <button class="filter-preset-btn" title="Save/Load Presets">📂</button>
                    <button class="filter-clear-btn" title="Clear All Filters">🗑️</button>
                    <button class="filter-toggle-btn" title="Toggle Panel">−</button>
                </div>
            </div>
            <div class="filter-panel-content">
                ${this.generateFilterInputs()}
                <div class="filter-actions">
                    <button class="apply-filters-btn">Apply Filters</button>
                    <button class="reset-filters-btn">Reset</button>
                    <div class="filter-stats">
                        <span class="filtered-count">0</span> / <span class="total-count">0</span> items
                    </div>
                </div>
            </div>
        `;

        // Add styles
        this.injectFilterStyles();
        
        // Add event listeners
        this.attachFilterEvents(panel);
        
        // Position panel
        this.positionFilterPanel(panel);
        
        this.filterPanel = panel;
        return panel;
    }

    /**
     * Generate HTML for filter inputs
     */
    generateFilterInputs() {
        let html = '<div class="filter-inputs">';
        
        Object.entries(this.filterTypes).forEach(([key, filter]) => {
            html += `<div class="filter-group" data-filter="${key}">`;
            html += `<label class="filter-label">${filter.name}</label>`;
            
            switch (filter.type) {
                case 'range':
                    html += `
                        <div class="range-inputs">
                            <input type="number" class="filter-min" placeholder="Min" 
                                   min="${filter.min}" max="${filter.max}" step="${filter.step}">
                            <span>to</span>
                            <input type="number" class="filter-max" placeholder="Max" 
                                   min="${filter.min}" max="${filter.max}" step="${filter.step}">
                        </div>
                    `;
                    break;
                case 'select':
                    html += `<select class="filter-select">
                        <option value="">Any</option>`;
                    filter.options.forEach(option => {
                        html += `<option value="${option.value}">${option.label}</option>`;
                    });
                    html += `</select>`;
                    break;
                case 'multiselect':
                    html += `<div class="filter-multiselect">`;
                    filter.options.forEach(option => {
                        html += `
                            <label class="checkbox-label">
                                <input type="checkbox" value="${option.value}">
                                ${option.label}
                            </label>
                        `;
                    });
                    html += `</div>`;
                    break;
                case 'text':
                    html += `<input type="text" class="filter-text" 
                             placeholder="${filter.placeholder || ''}">`;
                    break;
            }
            
            html += `</div>`;
        });
        
        html += '</div>';
        return html;
    }

    /**
     * Apply filters to items
     * @param {Object} filters - Filter criteria
     * @returns {Array} Filtered items
     */
    applyFilters(filters = null) {
        if (!filters) {
            filters = this.collectActiveFilters();
        }

        this.activeFilters = filters;
        this.filteredItems.clear();

        // Get all market items or inventory items
        const items = this.getAllItems();
        let filteredCount = 0;

        items.forEach((itemData, element) => {
            if (this.itemPassesFilters(itemData, filters)) {
                this.filteredItems.add(element);
                this.showItem(element);
                filteredCount++;
            } else {
                this.hideItem(element);
            }
        });

        this.updateFilterStats(filteredCount, items.size);
        return Array.from(this.filteredItems);
    }

    /**
     * Check if an item passes all active filters
     * @param {Object} itemData - Item data with float, pattern, etc.
     * @param {Object} filters - Filter criteria
     * @returns {boolean} Whether item passes filters
     */
    itemPassesFilters(itemData, filters) {
        // Float range filter
        if (filters.float && (filters.float.min !== undefined || filters.float.max !== undefined)) {
            const floatValue = itemData.floatValue || 0;
            if (filters.float.min !== undefined && floatValue < filters.float.min) return false;
            if (filters.float.max !== undefined && floatValue > filters.float.max) return false;
        }

        // Paint seed filter
        if (filters.paintSeed && (filters.paintSeed.min !== undefined || filters.paintSeed.max !== undefined)) {
            const paintSeed = itemData.paintSeed || 0;
            if (filters.paintSeed.min !== undefined && paintSeed < filters.paintSeed.min) return false;
            if (filters.paintSeed.max !== undefined && paintSeed > filters.paintSeed.max) return false;
        }

        // Pattern type filter
        if (filters.pattern && filters.pattern !== '') {
            const patternInfo = itemData.patternInfo;
            if (!patternInfo || !this.matchesPatternFilter(patternInfo, filters.pattern)) return false;
        }

        // Stickers filter
        if (filters.stickers && filters.stickers.trim() !== '') {
            const stickers = itemData.stickers || [];
            if (!this.matchesStickerFilter(stickers, filters.stickers)) return false;
        }

        // Price range filter
        if (filters.priceRange && (filters.priceRange.min !== undefined || filters.priceRange.max !== undefined)) {
            const price = itemData.price || 0;
            if (filters.priceRange.min !== undefined && price < filters.priceRange.min) return false;
            if (filters.priceRange.max !== undefined && price > filters.priceRange.max) return false;
        }

        // Wear condition filter
        if (filters.wear && filters.wear.length > 0) {
            const wearCondition = this.getWearCondition(itemData.floatValue || 1);
            if (!filters.wear.includes(wearCondition)) return false;
        }

        // Tradability filter
        if (filters.tradable && filters.tradable !== 'all') {
            const isTradable = itemData.tradable !== false;
            if (filters.tradable === 'tradable' && !isTradable) return false;
            if (filters.tradable === 'locked' && isTradable) return false;
        }

        return true;
    }

    /**
     * Check if pattern matches filter
     * @param {Object} patternInfo - Pattern information
     * @param {string} filterValue - Filter pattern type
     * @returns {boolean} Whether pattern matches
     */
    matchesPatternFilter(patternInfo, filterValue) {
        switch (filterValue) {
            case 'bluegem':
                return patternInfo.type && patternInfo.type.includes('Blue Gem');
            case 'doppler':
                return patternInfo.type === 'Doppler';
            case 'fade':
                return patternInfo.type === 'Fade';
            case 'marblefade':
                return patternInfo.type === 'Marble Fade';
            case 'casehardened':
                return patternInfo.type && patternInfo.type.includes('Case Hardened');
            default:
                return false;
        }
    }

    /**
     * Check if stickers match filter
     * @param {Array} stickers - Item stickers
     * @param {string} filterText - Filter text
     * @returns {boolean} Whether stickers match
     */
    matchesStickerFilter(stickers, filterText) {
        const keywords = filterText.toLowerCase().split(',').map(k => k.trim());
        return keywords.some(keyword => 
            stickers.some(sticker => 
                sticker.name && sticker.name.toLowerCase().includes(keyword)
            )
        );
    }

    /**
     * Get wear condition from float value
     * @param {number} floatValue - Float value
     * @returns {string} Wear condition code
     */
    getWearCondition(floatValue) {
        if (floatValue < 0.07) return 'fn';
        if (floatValue < 0.15) return 'mw';
        if (floatValue < 0.38) return 'ft';
        if (floatValue < 0.45) return 'ww';
        return 'bs';
    }

    /**
     * Collect active filters from UI
     * @returns {Object} Active filter values
     */
    collectActiveFilters() {
        const filters = {};
        
        if (!this.filterPanel) return filters;

        // Range filters
        ['float', 'paintSeed', 'priceRange'].forEach(filterKey => {
            const group = this.filterPanel.querySelector(`[data-filter="${filterKey}"]`);
            if (group) {
                const min = group.querySelector('.filter-min')?.value;
                const max = group.querySelector('.filter-max')?.value;
                if (min || max) {
                    filters[filterKey] = {};
                    if (min) filters[filterKey].min = parseFloat(min);
                    if (max) filters[filterKey].max = parseFloat(max);
                }
            }
        });

        // Select filters
        ['pattern', 'tradable'].forEach(filterKey => {
            const group = this.filterPanel.querySelector(`[data-filter="${filterKey}"]`);
            if (group) {
                const value = group.querySelector('.filter-select')?.value;
                if (value) filters[filterKey] = value;
            }
        });

        // Text filters
        const stickersInput = this.filterPanel.querySelector('[data-filter="stickers"] .filter-text');
        if (stickersInput && stickersInput.value.trim()) {
            filters.stickers = stickersInput.value.trim();
        }

        // Multi-select filters
        const wearGroup = this.filterPanel.querySelector('[data-filter="wear"]');
        if (wearGroup) {
            const checkedBoxes = wearGroup.querySelectorAll('input[type="checkbox"]:checked');
            if (checkedBoxes.length > 0) {
                filters.wear = Array.from(checkedBoxes).map(cb => cb.value);
            }
        }

        return filters;
    }

    /**
     * Get all items on the page for filtering
     * @returns {Map} Map of element -> item data
     */
    getAllItems() {
        const items = new Map();
        
        // Market listings
        const marketListings = document.querySelectorAll('.market_listing_row');
        marketListings.forEach(listing => {
            const itemData = this.extractItemData(listing);
            if (itemData) {
                items.set(listing, itemData);
            }
        });
        
        // Inventory items
        const inventoryItems = document.querySelectorAll('.item');
        inventoryItems.forEach(item => {
            const itemData = this.extractItemData(item);
            if (itemData) {
                items.set(item, itemData);
            }
        });

        this.allItems = items;
        return items;
    }

    /**
     * Extract item data from DOM element
     * @param {HTMLElement} element - Item element
     * @returns {Object|null} Extracted item data
     */
    extractItemData(element) {
        try {
            const floatDisplay = element.querySelector('.cs2-float-display');
            const patternDisplay = element.querySelector('.cs2-pattern-display');
            const priceElement = element.querySelector('.market_listing_price, .market_table_value');
            
            const itemData = {
                element,
                floatValue: null,
                paintSeed: null,
                patternInfo: null,
                stickers: [],
                price: null,
                tradable: true
            };

            // Extract float value
            if (floatDisplay) {
                const floatText = floatDisplay.textContent;
                const floatMatch = floatText.match(/Float[:\s]*([0-9.]+)/i);
                if (floatMatch) {
                    itemData.floatValue = parseFloat(floatMatch[1]);
                }
            }

            // Extract paint seed
            const paintSeedElement = element.querySelector('[title*="Pattern"], .paintseed');
            if (paintSeedElement) {
                const seedMatch = paintSeedElement.textContent.match(/(?:#|Pattern[:\s]*)(\d+)/);
                if (seedMatch) {
                    itemData.paintSeed = parseInt(seedMatch[1]);
                }
            }

            // Extract pattern info
            if (patternDisplay) {
                const patternText = patternDisplay.textContent;
                itemData.patternInfo = {
                    type: patternText.includes('Blue Gem') ? 'Case Hardened Blue Gem' :
                          patternText.includes('Doppler') ? 'Doppler' :
                          patternText.includes('Fade') ? 'Fade' :
                          patternText.includes('Marble') ? 'Marble Fade' : 'Unknown'
                };
            }

            // Extract price
            if (priceElement) {
                const priceText = priceElement.textContent;
                const priceMatch = priceText.match(/[\d,]+\.?\d*/);
                if (priceMatch) {
                    itemData.price = parseFloat(priceMatch[0].replace(/,/g, ''));
                }
            }

            return itemData;
        } catch (error) {
            console.warn('Error extracting item data:', error);
            return null;
        }
    }

    /**
     * Show filtered item
     * @param {HTMLElement} element - Item element
     */
    showItem(element) {
        element.style.display = '';
        element.classList.remove('cs2-filtered-out');
    }

    /**
     * Hide filtered out item
     * @param {HTMLElement} element - Item element
     */
    hideItem(element) {
        element.style.display = 'none';
        element.classList.add('cs2-filtered-out');
    }

    /**
     * Update filter statistics display
     * @param {number} filtered - Number of filtered items
     * @param {number} total - Total number of items
     */
    updateFilterStats(filtered, total) {
        if (this.filterPanel) {
            const filteredSpan = this.filterPanel.querySelector('.filtered-count');
            const totalSpan = this.filterPanel.querySelector('.total-count');
            if (filteredSpan) filteredSpan.textContent = filtered;
            if (totalSpan) totalSpan.textContent = total;
        }
    }

    /**
     * Position filter panel on page
     * @param {HTMLElement} panel - Filter panel element
     */
    positionFilterPanel(panel) {
        panel.style.cssText = `
            position: fixed;
            top: 100px;
            right: 20px;
            width: 320px;
            max-height: 80vh;
            overflow-y: auto;
            background: #1e1e1e;
            border: 2px solid #4e7a0d;
            border-radius: 8px;
            z-index: 10000;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.8);
        `;
        
        document.body.appendChild(panel);
    }

    /**
     * Inject filter panel styles
     */
    injectFilterStyles() {
        if (document.getElementById('cs2-filter-styles')) return;
        
        const styles = document.createElement('style');
        styles.id = 'cs2-filter-styles';
        styles.textContent = `
            .cs2-float-filter-panel {
                font-family: Arial, sans-serif;
                font-size: 12px;
                color: #c6d4df;
            }
            
            .filter-panel-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 12px 16px;
                background: #2a2a2a;
                border-radius: 6px 6px 0 0;
                border-bottom: 1px solid #4e7a0d;
            }
            
            .filter-panel-header h3 {
                margin: 0;
                color: #beee11;
                font-size: 14px;
            }
            
            .filter-controls {
                display: flex;
                gap: 8px;
            }
            
            .filter-controls button {
                background: #4e7a0d;
                border: none;
                color: white;
                padding: 4px 8px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 12px;
            }
            
            .filter-panel-content {
                padding: 16px;
            }
            
            .filter-inputs {
                display: flex;
                flex-direction: column;
                gap: 12px;
                margin-bottom: 16px;
            }
            
            .filter-group {
                display: flex;
                flex-direction: column;
                gap: 6px;
            }
            
            .filter-label {
                font-weight: bold;
                color: #beee11;
            }
            
            .range-inputs {
                display: flex;
                align-items: center;
                gap: 8px;
            }
            
            .range-inputs input {
                flex: 1;
                padding: 4px 8px;
                background: #333;
                border: 1px solid #555;
                border-radius: 4px;
                color: white;
            }
            
            .filter-select, .filter-text {
                width: 100%;
                padding: 6px 8px;
                background: #333;
                border: 1px solid #555;
                border-radius: 4px;
                color: white;
            }
            
            .filter-multiselect {
                display: flex;
                flex-direction: column;
                gap: 4px;
            }
            
            .checkbox-label {
                display: flex;
                align-items: center;
                gap: 6px;
                cursor: pointer;
            }
            
            .filter-actions {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding-top: 16px;
                border-top: 1px solid #4e7a0d;
            }
            
            .apply-filters-btn, .reset-filters-btn {
                background: linear-gradient(to bottom, #75b022 5%, #68a54b 100%);
                border: 1px solid #4e7a0d;
                color: white;
                padding: 8px 16px;
                border-radius: 4px;
                cursor: pointer;
                font-weight: bold;
            }
            
            .reset-filters-btn {
                background: linear-gradient(to bottom, #cc4444 5%, #aa2222 100%);
                border-color: #8b1a1a;
            }
            
            .filter-stats {
                font-size: 11px;
                color: #8f98a0;
            }
            
            .cs2-filtered-out {
                opacity: 0.3 !important;
                filter: grayscale(100%) !important;
            }
        `;
        
        document.head.appendChild(styles);
    }

    /**
     * Attach event listeners to filter panel
     * @param {HTMLElement} panel - Filter panel
     */
    attachFilterEvents(panel) {
        // Apply filters button
        const applyBtn = panel.querySelector('.apply-filters-btn');
        applyBtn?.addEventListener('click', () => {
            this.applyFilters();
        });

        // Reset filters button
        const resetBtn = panel.querySelector('.reset-filters-btn');
        resetBtn?.addEventListener('click', () => {
            this.resetFilters();
        });

        // Clear filters button
        const clearBtn = panel.querySelector('.filter-clear-btn');
        clearBtn?.addEventListener('click', () => {
            this.clearAllFilters();
        });

        // Toggle panel button
        const toggleBtn = panel.querySelector('.filter-toggle-btn');
        const content = panel.querySelector('.filter-panel-content');
        toggleBtn?.addEventListener('click', () => {
            const isVisible = content.style.display !== 'none';
            content.style.display = isVisible ? 'none' : 'block';
            toggleBtn.textContent = isVisible ? '+' : '−';
        });
    }

    /**
     * Reset all filters to default state
     */
    resetFilters() {
        if (!this.filterPanel) return;

        // Clear all inputs
        this.filterPanel.querySelectorAll('input, select').forEach(input => {
            if (input.type === 'checkbox') {
                input.checked = false;
            } else {
                input.value = '';
            }
        });

        // Show all items
        this.getAllItems().forEach((itemData, element) => {
            this.showItem(element);
        });

        this.activeFilters = {};
        this.updateFilterStats(this.allItems.size, this.allItems.size);
    }

    /**
     * Clear all filters and hide panel
     */
    clearAllFilters() {
        this.resetFilters();
        if (this.filterPanel) {
            this.filterPanel.remove();
            this.filterPanel = null;
        }
    }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FloatFilter;
} else {
    window.FloatFilter = FloatFilter;
}