/**
 * Float Ranking & Percentile System
 * Shows float rank and percentile for items (e.g., "#12 best float", "Top 1.5%")
 */

class FloatRanking {
    constructor() {
        this.rankCache = new Map();
        this.percentileData = new Map();
        this.initialized = false;
    }

    /**
     * Calculate percentile based on float value and item type
     */
    calculatePercentile(floatValue, minWear = 0.00, maxWear = 1.00) {
        // Calculate position within the wear range
        const range = maxWear - minWear;
        const position = (floatValue - minWear) / range;
        const percentile = position * 100;
        
        // Return inverse percentile (lower float = better percentile)
        return {
            percentile: (100 - percentile).toFixed(2),
            position: position,
            isTopTier: percentile <= 10,
            isBottomTier: percentile >= 90
        };
    }

    /**
     * Get rank display text based on percentile
     */
    getRankDisplay(percentile) {
        const pct = parseFloat(percentile);
        
        if (pct >= 99.9) {
            return {
                text: '#1 Float',
                color: '#fbbf24',
                icon: '👑',
                class: 'cs2-rank-legendary'
            };
        } else if (pct >= 99) {
            return {
                text: `Top 1%`,
                color: '#f59e0b',
                icon: '🔥',
                class: 'cs2-rank-elite'
            };
        } else if (pct >= 95) {
            return {
                text: `Top 5%`,
                color: '#10b981',
                icon: '✨',
                class: 'cs2-rank-rare'
            };
        } else if (pct >= 90) {
            return {
                text: `Top 10%`,
                color: '#22c55e',
                icon: '⭐',
                class: 'cs2-rank-uncommon'
            };
        } else if (pct >= 75) {
            return {
                text: `Top 25%`,
                color: '#3b82f6',
                icon: '',
                class: 'cs2-rank-good'
            };
        } else if (pct <= 10) {
            return {
                text: `Bottom 10%`,
                color: '#ef4444',
                icon: '⚠️',
                class: 'cs2-rank-poor'
            };
        } else {
            return {
                text: `${pct.toFixed(1)}%`,
                color: '#9ca3af',
                icon: '',
                class: 'cs2-rank-average'
            };
        }
    }

    /**
     * Fetch rank data from API (simulated for now)
     */
    async fetchRankData(marketHashName, floatValue) {
        // In a real implementation, this would fetch from CSFloat API or similar
        // For now, we'll simulate with calculated data
        
        const cacheKey = `${marketHashName}_${floatValue}`;
        if (this.rankCache.has(cacheKey)) {
            return this.rankCache.get(cacheKey);
        }

        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 100));

        // Generate simulated rank data based on float value
        const totalItems = Math.floor(Math.random() * 10000) + 1000;
        const betterItems = Math.floor(totalItems * (floatValue * floatValue)); // Quadratic distribution
        const rank = betterItems + 1;

        const rankData = {
            rank: rank,
            totalItems: totalItems,
            percentile: ((totalItems - rank) / totalItems * 100).toFixed(2),
            lastUpdated: new Date().toISOString()
        };

        this.rankCache.set(cacheKey, rankData);
        return rankData;
    }

    /**
     * Create ranking display element
     */
    createRankingElement(floatValue, minWear = 0.00, maxWear = 1.00, marketHashName = null) {
        const container = document.createElement('div');
        container.className = 'cs2-float-ranking';
        container.style.cssText = `
            display: inline-flex;
            align-items: center;
            gap: 8px;
            margin: 4px 0;
            font-size: 12px;
            font-weight: 600;
        `;

        // Calculate percentile
        const percentileData = this.calculatePercentile(floatValue, minWear, maxWear);
        const rankDisplay = this.getRankDisplay(percentileData.percentile);

        // Create rank badge
        const rankBadge = document.createElement('div');
        rankBadge.className = `cs2-rank-badge ${rankDisplay.class}`;
        rankBadge.style.cssText = `
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 2px 8px;
            background: ${rankDisplay.color}22;
            color: ${rankDisplay.color};
            border: 1px solid ${rankDisplay.color}44;
            border-radius: 12px;
            font-weight: 700;
            letter-spacing: 0.5px;
            animation: fadeIn 0.3s ease-in;
        `;

        if (rankDisplay.icon) {
            const icon = document.createElement('span');
            icon.textContent = rankDisplay.icon;
            icon.style.fontSize = '14px';
            rankBadge.appendChild(icon);
        }

        const rankText = document.createElement('span');
        rankText.textContent = rankDisplay.text;
        rankBadge.appendChild(rankText);

        container.appendChild(rankBadge);

        // Add exact rank if available
        if (marketHashName) {
            const rankInfo = document.createElement('div');
            rankInfo.className = 'cs2-rank-info';
            rankInfo.style.cssText = `
                display: inline-flex;
                align-items: center;
                padding: 2px 6px;
                background: rgba(0, 0, 0, 0.1);
                border-radius: 8px;
                color: #888;
                font-size: 11px;
            `;
            rankInfo.innerHTML = `<span style="margin-right: 4px;">📊</span> Loading rank...`;
            
            container.appendChild(rankInfo);

            // Fetch actual rank data asynchronously
            this.fetchRankData(marketHashName, floatValue).then(data => {
                if (data) {
                    rankInfo.innerHTML = `
                        <span style="margin-right: 4px;">📊</span>
                        #${data.rank.toLocaleString()} / ${data.totalItems.toLocaleString()}
                    `;
                    rankInfo.title = `Ranked #${data.rank} out of ${data.totalItems} items (${data.percentile}%)`;
                }
            }).catch(err => {
                console.error('Failed to fetch rank data:', err);
                rankInfo.style.display = 'none';
            });
        }

        // Add tooltip with detailed information
        const tooltip = document.createElement('div');
        tooltip.className = 'cs2-rank-tooltip';
        tooltip.style.cssText = `
            position: absolute;
            bottom: 100%;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.95);
            color: white;
            padding: 8px 12px;
            border-radius: 6px;
            font-size: 11px;
            white-space: nowrap;
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.2s;
            z-index: 10000;
            margin-bottom: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        `;

        tooltip.innerHTML = `
            <div style="margin-bottom: 4px; color: ${rankDisplay.color}; font-weight: 700;">
                ${rankDisplay.icon} ${rankDisplay.text} Float
            </div>
            <div style="color: #bbb;">
                Float: ${floatValue.toFixed(14)}
            </div>
            <div style="color: #bbb;">
                Range: ${minWear.toFixed(2)} - ${maxWear.toFixed(2)}
            </div>
            <div style="margin-top: 4px; padding-top: 4px; border-top: 1px solid #444;">
                ${percentileData.isTopTier ? '🏆 Collector Grade' : 
                  percentileData.isBottomTier ? '⚠️ High Wear' : 
                  '📊 Standard Grade'}
            </div>
        `;

        container.style.position = 'relative';
        container.appendChild(tooltip);

        // Show tooltip on hover
        container.addEventListener('mouseenter', () => {
            tooltip.style.opacity = '1';
        });
        
        container.addEventListener('mouseleave', () => {
            tooltip.style.opacity = '0';
        });

        return container;
    }

    /**
     * Add ranking to an element
     */
    addRanking(element, floatValue, minWear = 0.00, maxWear = 1.00, marketHashName = null) {
        // Check if ranking already exists
        if (element.querySelector('.cs2-float-ranking')) {
            return;
        }

        const ranking = this.createRankingElement(floatValue, minWear, maxWear, marketHashName);
        
        // Find the best place to insert the ranking
        const floatDisplay = element.querySelector('.cs2-float-value, .float-value');
        if (floatDisplay && floatDisplay.parentElement) {
            // Insert after the float value
            floatDisplay.parentElement.insertBefore(ranking, floatDisplay.nextSibling);
        } else {
            element.appendChild(ranking);
        }
    }

    /**
     * Initialize ranking system
     */
    init() {
        console.log('[FloatRanking] Initializing float ranking system...');
        
        // Inject required styles
        this.injectStyles();
        
        // Watch for float values being added to the page
        this.observeFloatValues();
        
        this.initialized = true;
    }

    /**
     * Inject required CSS styles
     */
    injectStyles() {
        if (document.getElementById('cs2-float-ranking-styles')) return;
        
        const styles = document.createElement('style');
        styles.id = 'cs2-float-ranking-styles';
        styles.textContent = `
            @keyframes fadeIn {
                from { opacity: 0; transform: scale(0.9); }
                to { opacity: 1; transform: scale(1); }
            }
            
            .cs2-rank-badge {
                transition: all 0.2s ease;
                cursor: help;
            }
            
            .cs2-rank-badge:hover {
                transform: scale(1.05);
                box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            }
            
            .cs2-rank-legendary {
                background: linear-gradient(135deg, #fbbf2422, #f59e0b22) !important;
                animation: shimmer 3s ease-in-out infinite;
            }
            
            .cs2-rank-elite {
                animation: pulse 2s ease-in-out infinite;
            }
            
            @keyframes shimmer {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.8; }
            }
            
            @keyframes pulse {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.02); }
            }
            
            .cs2-rank-info {
                transition: all 0.2s ease;
            }
            
            .cs2-rank-info:hover {
                background: rgba(0, 0, 0, 0.2) !important;
            }
            
            .cs2-float-ranking {
                user-select: none;
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
                                    // Find the parent container
                                    const container = floatEl.closest('.market_listing_row, .item_market_action_button_contents, [id*="listing_"], [id*="item_"]');
                                    if (container) {
                                        // Get item details if available
                                        const marketHashName = container.dataset.marketHashName || 
                                                             container.querySelector('.market_listing_item_name')?.textContent || 
                                                             null;
                                        const minWear = parseFloat(container.dataset.minWear || '0.00');
                                        const maxWear = parseFloat(container.dataset.maxWear || '1.00');
                                        
                                        this.addRanking(container, floatValue, minWear, maxWear, marketHashName);
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

    /**
     * Get statistics for a specific item type
     */
    async getItemStatistics(marketHashName) {
        // This would connect to a real API in production
        // For now, return simulated statistics
        return {
            totalCount: Math.floor(Math.random() * 50000) + 10000,
            averageFloat: 0.25 + Math.random() * 0.3,
            medianFloat: 0.27 + Math.random() * 0.2,
            distribution: {
                factoryNew: 15,
                minimalWear: 25,
                fieldTested: 35,
                wellWorn: 15,
                battleScarred: 10
            }
        };
    }
}

// Auto-initialize when loaded
if (typeof window !== 'undefined') {
    window.CS2FloatRanking = new FloatRanking();
    
    // Initialize on page load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            window.CS2FloatRanking.init();
        });
    } else {
        window.CS2FloatRanking.init();
    }
}

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FloatRanking;
}