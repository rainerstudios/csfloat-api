/**
 * Trade Protection Tracker
 *
 * KILLER FEATURE: Detects items that can be reversed within 7-day window
 * Solves the #1 problem in CS2 trading (June 2025 Trade Protection Update)
 *
 * This is YOUR competitive advantage - no other extension has this!
 */

class TradeProtectionTracker {
    constructor(apiBaseUrl) {
        this.apiBaseUrl = apiBaseUrl || 'http://localhost:3000';
        this.cache = new Map();
        this.cacheExpiry = 5 * 60 * 1000; // 5 minutes
    }

    /**
     * Get ownership history and trade risk for an item
     * @param {string} floatId - The float ID of the item
     * @returns {Promise<Object>} Trade risk data
     */
    async getTradeRisk(floatId) {
        // Check cache first
        const cached = this.cache.get(floatId);
        if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
            return cached.data;
        }

        try {
            const response = await fetch(`${this.apiBaseUrl}/api/ownership-history/${floatId}`);

            if (!response.ok) {
                throw new Error(`API returned ${response.status}`);
            }

            const data = await response.json();

            // Cache the result
            this.cache.set(floatId, {
                data: data,
                timestamp: Date.now()
            });

            return data;
        } catch (error) {
            console.error('[TradeProtectionTracker] Error fetching trade risk:', error);
            return {
                tradeRisk: {
                    risk: 'UNKNOWN',
                    message: 'Unable to fetch trade history',
                    canReverse: false
                }
            };
        }
    }

    /**
     * Create visual badge for trade risk indicator
     * @param {Object} tradeRisk - Trade risk data from API
     * @returns {HTMLElement} Badge element
     */
    createRiskBadge(tradeRisk) {
        const badge = document.createElement('div');
        badge.className = 'trade-risk-badge';

        const riskLevel = tradeRisk.risk;

        // Style based on risk level
        let bgColor, textColor, icon;
        switch(riskLevel) {
            case 'HIGH':
                bgColor = '#c23030';
                textColor = '#ffffff';
                icon = '⚠️';
                break;
            case 'SAFE':
                bgColor = '#4c6c22';
                textColor = '#ffffff';
                icon = '✅';
                break;
            default:
                bgColor = '#666666';
                textColor = '#ffffff';
                icon = '❓';
        }

        badge.style.cssText = `
            display: inline-flex;
            align-items: center;
            gap: 6px;
            background: ${bgColor};
            color: ${textColor};
            padding: 4px 10px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 600;
            margin: 4px 0;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            cursor: help;
        `;

        // Create content
        const iconSpan = document.createElement('span');
        iconSpan.textContent = icon;
        iconSpan.style.fontSize = '14px';

        const textSpan = document.createElement('span');

        if (riskLevel === 'HIGH' && tradeRisk.daysRemaining) {
            textSpan.textContent = `REVERSIBLE (${tradeRisk.daysRemaining}d left)`;
        } else if (riskLevel === 'SAFE') {
            textSpan.textContent = 'SAFE TO TRADE';
        } else {
            textSpan.textContent = tradeRisk.message.replace(/[⚠️✅]/g, '').trim();
        }

        badge.appendChild(iconSpan);
        badge.appendChild(textSpan);

        // Add tooltip with detailed info
        badge.title = this.createTooltipText(tradeRisk);

        return badge;
    }

    /**
     * Create detailed tooltip text
     * @param {Object} tradeRisk - Trade risk data
     * @returns {string} Tooltip text
     */
    createTooltipText(tradeRisk) {
        let tooltip = tradeRisk.message + '\n\n';

        if (tradeRisk.risk === 'HIGH') {
            tooltip += `⚠️ WARNING: This item was traded recently!\n`;
            tooltip += `The previous owner can reverse the trade until:\n`;
            tooltip += `${new Date(tradeRisk.reversibleUntil).toLocaleString()}\n\n`;
            tooltip += `Days remaining: ${tradeRisk.daysRemaining}\n`;
            tooltip += `Last trade: ${new Date(tradeRisk.lastTradeDate).toLocaleString()}\n\n`;
            tooltip += `RECOMMENDATION: Wait ${tradeRisk.daysRemaining} days before trading this item.`;
        } else if (tradeRisk.risk === 'SAFE') {
            tooltip += `✅ This item is safe to trade!\n\n`;
            tooltip += `Last trade was ${tradeRisk.daysSinceLastTrade} days ago.\n`;
            tooltip += `The 7-day reversal window has passed.`;
        }

        return tooltip;
    }

    /**
     * Create expanded ownership history panel
     * @param {Array} ownershipHistory - Array of ownership records
     * @param {Object} tradeRisk - Trade risk data
     * @returns {HTMLElement} History panel
     */
    createHistoryPanel(ownershipHistory, tradeRisk) {
        const panel = document.createElement('div');
        panel.className = 'trade-history-panel';
        panel.style.cssText = `
            background: #1b2838;
            border: 1px solid #3d4450;
            border-radius: 4px;
            padding: 12px;
            margin: 10px 0;
            font-size: 12px;
            color: #c7d5e0;
        `;

        // Header
        const header = document.createElement('div');
        header.style.cssText = `
            font-weight: bold;
            font-size: 13px;
            margin-bottom: 8px;
            color: #ffffff;
            display: flex;
            justify-content: space-between;
            align-items: center;
        `;

        const headerText = document.createElement('span');
        headerText.textContent = '📜 Trade History';

        const toggleBtn = document.createElement('button');
        toggleBtn.textContent = '▼';
        toggleBtn.style.cssText = `
            background: none;
            border: none;
            color: #66c0f4;
            cursor: pointer;
            font-size: 12px;
            padding: 0;
        `;

        header.appendChild(headerText);
        header.appendChild(toggleBtn);
        panel.appendChild(header);

        // Risk summary
        const riskSummary = document.createElement('div');
        riskSummary.style.cssText = `
            background: ${tradeRisk.risk === 'HIGH' ? '#4c1a1a' : '#1a3e1a'};
            padding: 8px;
            border-radius: 3px;
            margin-bottom: 8px;
        `;
        riskSummary.textContent = tradeRisk.message;
        panel.appendChild(riskSummary);

        // History list
        const historyList = document.createElement('div');
        historyList.className = 'history-list';
        historyList.style.cssText = `
            max-height: 200px;
            overflow-y: auto;
            display: none;
        `;

        if (ownershipHistory && ownershipHistory.length > 0) {
            ownershipHistory.forEach((record, index) => {
                const item = document.createElement('div');
                item.style.cssText = `
                    padding: 6px;
                    border-bottom: 1px solid #3d4450;
                    display: flex;
                    justify-content: space-between;
                `;

                const dateSpan = document.createElement('span');
                dateSpan.textContent = new Date(record.date).toLocaleDateString();

                const infoSpan = document.createElement('span');
                if (record.price) {
                    infoSpan.textContent = `Listed: $${(record.price / 100).toFixed(2)}`;
                } else {
                    infoSpan.textContent = `Traded`;
                }
                infoSpan.style.color = '#8b9ba8';

                item.appendChild(dateSpan);
                item.appendChild(infoSpan);
                historyList.appendChild(item);
            });
        } else {
            const noData = document.createElement('div');
            noData.textContent = 'No trade history available';
            noData.style.cssText = 'padding: 8px; color: #8b9ba8; text-align: center;';
            historyList.appendChild(noData);
        }

        panel.appendChild(historyList);

        // Toggle functionality
        let expanded = false;
        toggleBtn.addEventListener('click', () => {
            expanded = !expanded;
            historyList.style.display = expanded ? 'block' : 'none';
            toggleBtn.textContent = expanded ? '▲' : '▼';
        });

        return panel;
    }

    /**
     * Inject trade risk indicator into market listing
     * @param {HTMLElement} listingElement - The market listing DOM element
     * @param {Object} itemData - Item data including floatId
     */
    async injectIntoListing(listingElement, itemData) {
        if (!itemData.floatid) {
            console.warn('[TradeProtectionTracker] No float ID available');
            return;
        }

        // Check if already injected
        if (listingElement.querySelector('.trade-risk-badge')) {
            return;
        }

        try {
            const riskData = await this.getTradeRisk(itemData.floatid);

            // Create and inject badge
            const badge = this.createRiskBadge(riskData.tradeRisk);

            // Find the best insertion point (near price or float value)
            const priceElement = listingElement.querySelector('.market_listing_price');
            if (priceElement) {
                priceElement.insertAdjacentElement('afterend', badge);
            } else {
                // Fallback: prepend to listing
                listingElement.insertBefore(badge, listingElement.firstChild);
            }

            // Add detailed history panel (collapsed by default)
            if (riskData.ownershipHistory && riskData.ownershipHistory.length > 0) {
                const historyPanel = this.createHistoryPanel(
                    riskData.ownershipHistory,
                    riskData.tradeRisk
                );
                badge.insertAdjacentElement('afterend', historyPanel);
            }

            // Highlight high-risk items
            if (riskData.tradeRisk.risk === 'HIGH') {
                listingElement.style.border = '2px solid #c23030';
                listingElement.style.background = 'rgba(194, 48, 48, 0.1)';
            }

        } catch (error) {
            console.error('[TradeProtectionTracker] Failed to inject:', error);
        }
    }

    /**
     * Show notification to user
     * @param {string} message - Notification message
     * @param {string} type - Notification type (info, warning, error)
     */
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = 'trade-protection-notification';

        const bgColors = {
            info: '#4c6c22',
            warning: '#c98007',
            error: '#c23030'
        };

        notification.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            background: ${bgColors[type] || bgColors.info};
            color: white;
            padding: 12px 20px;
            border-radius: 4px;
            z-index: 10000;
            font-size: 14px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            animation: slideIn 0.3s ease-out;
        `;

        notification.textContent = message;
        document.body.appendChild(notification);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 5000);
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TradeProtectionTracker;
}
