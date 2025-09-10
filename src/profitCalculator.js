/**
 * Steam Market Profit Calculator
 * Calculates actual profit after Steam's 15% fee (5% Steam + 10% Publisher)
 * @version 1.0.0
 * @author CS2 Float Checker Team
 */

class ProfitCalculator {
    constructor() {
        this.currency = '$';
        this.feeStructure = {
            steamFee: 0.05,      // 5% Steam fee
            publisherFee: 0.10,  // 10% Publisher fee for CS2
            totalFee: 0.15       // Total 15% fee
        };
    }

    /**
     * Calculate profit information from listing data
     * @param {Object} listingInfo - Steam listing data with price and fee
     * @returns {Object|null} Profit calculation results
     */
    calculateProfitInfo(listingInfo) {
        if (!listingInfo || typeof listingInfo.price !== 'number' || typeof listingInfo.fee !== 'number') {
            return null;
        }

        // Get the gross price (price + fee that buyer pays)
        const grossPrice = (listingInfo.price + listingInfo.fee) / 100;
        
        // Calculate individual fees
        const steamFee = grossPrice * this.feeStructure.steamFee;
        const publisherFee = grossPrice * this.feeStructure.publisherFee;
        const totalFees = steamFee + publisherFee;
        
        // Calculate net amount seller receives
        const netProfit = grossPrice - totalFees;
        
        // Calculate fee percentage of gross price
        const feePercentage = (totalFees / grossPrice) * 100;
        
        return {
            grossPrice,
            steamFee,
            publisherFee,
            totalFees,
            netProfit,
            feePercentage
        };
    }

    /**
     * Format currency amount
     * @param {number} amount - Amount to format
     * @returns {string} Formatted currency string
     */
    formatCurrency(amount) {
        if (typeof amount !== 'number' || isNaN(amount)) {
            return `${this.currency}0.00`;
        }
        return `${this.currency}${amount.toFixed(2)}`;
    }

    /**
     * Create profit display element
     * @param {Object} listingInfo - Steam listing data
     * @param {string} type - Display type ('market' or 'inventory')
     * @returns {HTMLElement} Profit display element
     */
    createProfitDisplay(listingInfo, type = 'market') {
        const profitInfo = this.calculateProfitInfo(listingInfo);
        
        if (!profitInfo) {
            return null;
        }

        const container = document.createElement('div');
        container.className = `cs2-profit-display cs2-profit-${type}`;
        
        if (type === 'market') {
            container.innerHTML = `
                <div class="profit-info" style="
                    display: inline-flex;
                    flex-direction: column;
                    gap: 2px;
                    padding: 4px 6px;
                    background: rgba(0, 0, 0, 0.15);
                    border-radius: 3px;
                    border-left: 3px solid #4CAF50;
                    min-width: 120px;
                    font-size: 11px;
                    margin-left: 10px;
                " title="Steam Fee: ${this.formatCurrency(profitInfo.steamFee)} (5%)&#10;Publisher Fee: ${this.formatCurrency(profitInfo.publisherFee)} (10%)&#10;Total Fees: ${this.formatCurrency(profitInfo.totalFees)} (${profitInfo.feePercentage.toFixed(1)}%)">
                    <div class="profit-row" style="
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    ">
                        <span class="profit-label" style="color: #8f98a0; font-size: 10px;">Gross Price:</span>
                        <span class="profit-value gross-price" style="color: #ffa500; font-weight: bold; font-size: 11px;">
                            ${this.formatCurrency(profitInfo.grossPrice)}
                        </span>
                    </div>
                    <div class="profit-row" style="
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    ">
                        <span class="profit-label" style="color: #8f98a0; font-size: 10px;">Fees (-15%):</span>
                        <span class="profit-value fees" style="color: #ff6b6b; font-weight: bold; font-size: 11px;">
                            -${this.formatCurrency(profitInfo.totalFees)}
                        </span>
                    </div>
                    <div class="profit-row" style="
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    ">
                        <span class="profit-label" style="color: #8f98a0; font-size: 10px;">Net Profit:</span>
                        <span class="profit-value net-profit" style="color: #4CAF50; font-weight: bold; font-size: 12px;">
                            ${this.formatCurrency(profitInfo.netProfit)}
                        </span>
                    </div>
                    <div class="fee-breakdown" style="
                        font-size: 9px;
                        color: #666;
                        margin-top: 2px;
                        padding-top: 2px;
                        border-top: 1px solid rgba(255, 255, 255, 0.1);
                    ">
                        Steam: ${this.formatCurrency(profitInfo.steamFee)} | 
                        Publisher: ${this.formatCurrency(profitInfo.publisherFee)}
                    </div>
                </div>
            `;
        }
        
        return container;
    }

    /**
     * Extract listing data from Steam market element
     * @param {HTMLElement} marketElement - Market listing element
     * @returns {Object|null} Extracted listing data
     */
    extractListingData(marketElement) {
        try {
            // Look for price information in market listing
            const priceElement = marketElement.querySelector('.market_listing_price .normal_price');
            if (!priceElement) {
                return null;
            }

            const priceText = priceElement.textContent.trim();
            const priceMatch = priceText.match(/[\d,]+\.?\d*/);
            
            if (!priceMatch) {
                return null;
            }

            // Convert price to cents (Steam uses cents internally)
            const price = parseFloat(priceMatch[0].replace(/,/g, '')) * 100;
            
            // Steam fee is calculated as part of the displayed price
            // For simplicity, we'll estimate the fee as 15% of the base price
            const basePrice = price / 1.15;
            const fee = price - basePrice;

            return {
                price: Math.round(basePrice),
                fee: Math.round(fee)
            };
        } catch (error) {
            console.error('Error extracting listing data:', error);
            return null;
        }
    }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ProfitCalculator;
} else {
    window.ProfitCalculator = ProfitCalculator;
}