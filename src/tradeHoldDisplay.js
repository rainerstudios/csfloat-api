/**
 * Trade Hold Display
 * Shows trade restrictions, countdown timers, and tradability status
 * @version 1.0.0
 * @author CS2 Float Checker Team
 */

class TradeHoldDisplay {
    constructor() {
        // Common trade hold periods in hours
        this.TRADE_HOLD_PERIODS = {
            MOBILE_AUTH: 168,    // 7 days
            NEW_DEVICE: 168,     // 7 days
            NEW_TRADE_PARTNER: 15 * 24,  // 15 days
            MARKET_LISTING: 168  // 7 days
        };
    }

    /**
     * Get trade hold information from asset
     * @param {Object} asset - Steam asset object
     * @returns {Object} Trade hold information
     */
    getTradeHoldInfo(asset) {
        if (!asset) {
            return { tradable: true };
        }

        // Check if asset is tradable
        if (asset.tradable === 0) {
            // Look for trade restriction in descriptions
            const descriptions = asset.descriptions || [];
            const tradeRestriction = descriptions.find(desc => 
                desc.value && desc.value.includes('Tradable After')
            );

            if (tradeRestriction) {
                // Extract date from description - handle multiple formats
                const datePatterns = [
                    /Tradable After (.+)/,
                    /This item can be traded after (.+)/,
                    /Trade cooldown ends: (.+)/
                ];
                
                let dateMatch = null;
                for (const pattern of datePatterns) {
                    dateMatch = tradeRestriction.value.match(pattern);
                    if (dateMatch) break;
                }
                
                if (dateMatch) {
                    const dateString = dateMatch[1].trim();
                    const restrictionDate = new Date(dateString);
                    
                    // Validate that we got a valid date
                    if (!isNaN(restrictionDate.getTime())) {
                        const now = new Date();
                        
                        if (restrictionDate > now) {
                            const daysLeft = Math.ceil((restrictionDate - now) / (1000 * 60 * 60 * 24));
                            return {
                                tradable: false,
                                daysLeft: daysLeft,
                                date: restrictionDate
                            };
                        }
                    }
                }
            }
            
            // If no date found but marked as non-tradable
            return { tradable: false };
        }

        return { tradable: true };
    }

    /**
     * Create trade hold display element
     * @param {Object} asset - Steam asset object
     * @param {string} type - Display type ('market' or 'inventory')
     * @returns {HTMLElement|null} Trade hold display element
     */
    createTradeHoldDisplay(asset, type = 'market') {
        const tradeHoldInfo = this.getTradeHoldInfo(asset);
        
        const container = document.createElement('div');
        container.className = `cs2-trade-hold-display cs2-trade-hold-${type}`;
        
        let iconHtml = '';
        let statusText = '';
        let statusClass = '';
        let tooltipText = '';

        if (tradeHoldInfo.tradable) {
            iconHtml = '✅';
            statusText = 'Tradable';
            statusClass = 'tradable';
            tooltipText = 'This item can be traded immediately';
        } else if (tradeHoldInfo.daysLeft) {
            iconHtml = '⏱️';
            statusText = `${tradeHoldInfo.daysLeft}d left`;
            statusClass = 'trade-hold-days';
            tooltipText = `Trade hold expires in ${tradeHoldInfo.daysLeft} days`;
            
            if (tradeHoldInfo.date) {
                tooltipText += `\\nAvailable: ${tradeHoldInfo.date.toLocaleDateString()}`;
            }
        } else {
            iconHtml = '❌';
            statusText = 'Not Tradable';
            statusClass = 'not-tradable';
            tooltipText = 'This item cannot be traded';
        }

        if (type === 'market') {
            container.innerHTML = `
                <div class="trade-hold-info" style="
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    padding: 2px 6px;
                    background: rgba(0, 0, 0, 0.2);
                    border-radius: 3px;
                    font-size: 11px;
                    margin-left: 10px;
                " title="${tooltipText}">
                    <span class="icon" style="
                        width: 14px;
                        height: 14px;
                        display: inline-block;
                        vertical-align: middle;
                        font-size: 12px;
                    ">${iconHtml}</span>
                    <span class="status-text ${statusClass}" style="
                        color: ${this.getStatusColor(statusClass)};
                        font-weight: bold;
                    ">${statusText}</span>
                </div>
            `;
        } else {
            // Inventory display - more compact
            container.innerHTML = `
                <div class="trade-hold-inventory" style="
                    display: inline-flex;
                    align-items: center;
                    gap: 2px;
                    padding: 1px 3px;
                    background: rgba(0, 0, 0, 0.8);
                    border-radius: 2px;
                    font-size: 9px;
                " title="${tooltipText}">
                    <span style="color: ${this.getStatusColor(statusClass)}">${iconHtml} ${statusText}</span>
                </div>
            `;
        }
        
        return container;
    }

    /**
     * Get color for status
     * @param {string} statusClass - Status class name
     * @returns {string} Color code
     */
    getStatusColor(statusClass) {
        switch (statusClass) {
            case 'tradable':
                return '#5bc633';
            case 'not-tradable':
                return '#ff7b7b';
            case 'trade-hold-days':
                return '#ffa500';
            default:
                return '#8f98a0';
        }
    }

    /**
     * Extract asset data from Steam element
     * @param {HTMLElement} element - Steam market or inventory element
     * @returns {Object|null} Asset data
     */
    extractAssetData(element) {
        try {
            // Look for asset data in various places
            let asset = null;

            // Try to find asset data in Steam's global variables
            if (typeof g_rgAssets !== 'undefined' && g_rgAssets) {
                // Market page asset extraction
                const listingId = element.id;
                if (listingId) {
                    // Find matching asset
                    for (const appId in g_rgAssets) {
                        for (const contextId in g_rgAssets[appId]) {
                            for (const assetId in g_rgAssets[appId][contextId]) {
                                const assetData = g_rgAssets[appId][contextId][assetId];
                                if (assetData) {
                                    asset = assetData;
                                    break;
                                }
                            }
                        }
                    }
                }
            }

            // If no asset found, create a default one
            if (!asset) {
                asset = {
                    tradable: 1, // Default to tradable
                    descriptions: []
                };
            }

            return asset;
        } catch (error) {
            console.error('Error extracting asset data:', error);
            return { tradable: 1, descriptions: [] };
        }
    }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TradeHoldDisplay;
} else {
    window.TradeHoldDisplay = TradeHoldDisplay;
}