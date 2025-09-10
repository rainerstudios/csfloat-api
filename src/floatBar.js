/**
 * Float Bar Visualization Component
 * Displays a visual bar showing where the float value sits within the wear range
 */

class FloatBar {
    constructor() {
        this.wearRanges = {
            'Factory New': { min: 0.00, max: 0.07, color: '#4ade80', shortName: 'FN' },
            'Minimal Wear': { min: 0.07, max: 0.15, color: '#22c55e', shortName: 'MW' },
            'Field-Tested': { min: 0.15, max: 0.38, color: '#facc15', shortName: 'FT' },
            'Well-Worn': { min: 0.38, max: 0.45, color: '#fb923c', shortName: 'WW' },
            'Battle-Scarred': { min: 0.45, max: 1.00, color: '#ef4444', shortName: 'BS' }
        };
    }

    /**
     * Get wear category from float value
     */
    getWearCategory(floatValue) {
        for (const [name, range] of Object.entries(this.wearRanges)) {
            if (floatValue >= range.min && floatValue <= range.max) {
                return { name, ...range };
            }
        }
        return null;
    }

    /**
     * Create the float bar HTML element (based on CSFloat implementation)
     */
    createFloatBar(floatValue, minWear = 0.00, maxWear = 1.00) {
        const container = document.createElement('div');
        container.className = 'cs2-float-bar-container';
        
        // Calculate percentages like CSFloat does
        const minFloatPercentage = minWear * 100;
        const maxFloatPercentage = maxWear * 100;
        const dynamicWidth = maxFloatPercentage - minFloatPercentage;
        const markerLeft = (((floatValue - minWear) * 100) / (maxWear - minWear));
        
        container.style.cssText = `
            position: relative;
            width: ${dynamicWidth.toFixed(2)}%;
            left: ${minFloatPercentage.toFixed(0)}%;
            height: 8px;
            margin: 5px 0;
        `;

        // Float conditions matching CSFloat's color scheme
        const floatConditions = [
            {min: 0, max: 7, color: 'green'},
            {min: 7, max: 15, color: '#18a518'},
            {min: 15, max: 38, color: '#9acd32'},
            {min: 38, max: 45, color: '#cd5c5c'},
            {min: 45, max: 100, color: '#f92424'},
        ];

        // Create the segmented bar
        const barContainer = document.createElement('div');
        barContainer.style.cssText = `
            height: 8px;
            border-radius: 4px;
            overflow: hidden;
            font-size: 0;
            display: flex;
        `;

        // Helper function to calculate condition width
        const getConditionWidth = (condMin, condMax) => {
            return Math.max(
                0,
                (Math.min(condMax, maxFloatPercentage) - Math.max(condMin, minFloatPercentage)) * 100
            ) / dynamicWidth;
        };

        // Add condition segments
        floatConditions.forEach((condition, index) => {
            const segment = document.createElement('div');
            const width = getConditionWidth(condition.min, condition.max);
            
            segment.style.cssText = `
                display: inline-block;
                vertical-align: top;
                height: 100%;
                opacity: 0.8;
                width: ${width}%;
                background-color: ${condition.color};
                ${index === 0 ? 'border-radius: 4px 0 0 4px;' : ''}
                ${index === floatConditions.length - 1 ? 'border-radius: 0 4px 4px 0;' : ''}
            `;
            
            barContainer.appendChild(segment);
        });

        // Create the float marker
        const marker = document.createElement('div');
        marker.className = 'cs2-float-bar-marker';
        marker.style.cssText = `
            position: absolute;
            background-color: #d9d9d9;
            width: 3px;
            top: -3px;
            height: 14px;
            border-radius: 4px;
            left: calc(${markerLeft.toFixed(3)}% - 2px);
            box-shadow: 0 1px 2px rgba(0,0,0,0.3);
        `;

        // Add tooltip
        const tooltip = document.createElement('div');
        tooltip.className = 'cs2-float-tooltip';
        tooltip.style.cssText = `
            position: absolute;
            bottom: 100%;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 11px;
            white-space: nowrap;
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.2s;
            z-index: 1000;
            margin-bottom: 4px;
        `;
        
        const formatFloat = (value) => Number(value.toFixed(4));
        tooltip.textContent = `Represents the float range of this skin (${formatFloat(minWear)}-${formatFloat(maxWear)})`;
        
        // Show tooltip on hover
        container.addEventListener('mouseenter', () => {
            tooltip.style.opacity = '1';
        });
        
        container.addEventListener('mouseleave', () => {
            tooltip.style.opacity = '0';
        });

        // Assemble the components
        container.appendChild(barContainer);
        container.appendChild(marker);
        container.appendChild(tooltip);

        return container;
    }

    /**
     * Get quality text based on float position
     */
    getQualityText(floatValue, minWear, maxWear) {
        const position = ((floatValue - minWear) / (maxWear - minWear)) * 100;
        
        if (position <= 5) {
            return { text: '🔥 Top 5% Float', color: '#10b981' };
        } else if (position <= 10) {
            return { text: '✨ Top 10% Float', color: '#22c55e' };
        } else if (position >= 95) {
            return { text: '⚠️ Bottom 5% Float', color: '#ef4444' };
        } else if (position >= 90) {
            return { text: 'Bottom 10% Float', color: '#f97316' };
        }
        
        return null;
    }

    /**
     * Add float bar to an element
     */
    addFloatBar(element, floatValue, minWear = 0.00, maxWear = 1.00) {
        // Check if float bar already exists
        if (element.querySelector('.cs2-float-bar-container')) {
            return;
        }

        const floatBar = this.createFloatBar(floatValue, minWear, maxWear);
        
        // Find the best place to insert the float bar
        const floatDisplay = element.querySelector('.cs2-float-value, .float-value');
        if (floatDisplay && floatDisplay.parentElement) {
            floatDisplay.parentElement.insertBefore(floatBar, floatDisplay.nextSibling);
        } else {
            element.appendChild(floatBar);
        }
    }

    /**
     * Initialize float bars for all items on the page
     */
    init() {
        console.log('[FloatBar] Initializing float bar visualization...');
        
        // Inject required styles
        this.injectStyles();
        
        // Watch for float values being added to the page
        this.observeFloatValues();
    }

    /**
     * Inject required CSS styles
     */
    injectStyles() {
        if (document.getElementById('cs2-float-bar-styles')) return;
        
        const styles = document.createElement('style');
        styles.id = 'cs2-float-bar-styles';
        styles.textContent = `
            .cs2-float-bar-container {
                animation: fadeIn 0.3s ease-in;
            }
            
            .cs2-float-indicator:hover {
                width: 3px !important;
                cursor: pointer;
            }
            
            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(-5px); }
                to { opacity: 1; transform: translateY(0); }
            }
            
            .cs2-float-quality {
                animation: pulse 2s ease-in-out infinite;
            }
            
            @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.7; }
            }
        `;
        document.head.appendChild(styles);
    }

    /**
     * Observe for float values being added to the page
     */
    observeFloatValues() {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1) { // Element node
                        // Check if this is a float value element
                        const floatElements = node.querySelectorAll ? 
                            node.querySelectorAll('.cs2-float-value, .float-value') : [];
                        
                        floatElements.forEach((floatEl) => {
                            const floatText = floatEl.textContent;
                            const floatMatch = floatText.match(/[\d.]+/);
                            if (floatMatch) {
                                const floatValue = parseFloat(floatMatch[0]);
                                if (!isNaN(floatValue) && floatValue >= 0 && floatValue <= 1) {
                                    // Find the parent container for this float value
                                    const container = floatEl.closest('.market_listing_row, .item_market_action_button_contents, [id*="listing_"], [id*="item_"]');
                                    if (container) {
                                        // Get min/max wear from data attributes if available
                                        const minWear = parseFloat(container.dataset.minWear || '0.00');
                                        const maxWear = parseFloat(container.dataset.maxWear || '1.00');
                                        
                                        this.addFloatBar(container, floatValue, minWear, maxWear);
                                    }
                                }
                            }
                        });
                    }
                });
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
}

// Auto-initialize when loaded
if (typeof window !== 'undefined') {
    window.CS2FloatBar = new FloatBar();
    
    // Initialize on page load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            window.CS2FloatBar.init();
        });
    } else {
        window.CS2FloatBar.init();
    }
}

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FloatBar;
}