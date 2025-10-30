/**
 * Steam Market Fee Calculation Library
 * Accurately calculates Steam Community Market fees
 * Fee scales from 10% to 13.05% based on item price
 *
 * Based on research from SkinVault repository
 */

// Steam fee configuration
const MIN_PRICE = 0.20;    // Minimum market price ($0.20)
const MAX_PRICE = 1800.00; // Maximum price for fee scaling ($1800)
const MIN_FEE = 0.10;      // Minimum fee percentage (10%)
const MAX_FEE = 0.1305;    // Maximum fee percentage (13.05%)

/**
 * Calculate Steam fee percentage for a given price
 * Fee scales linearly from 10% to 13.05% between $0.20 and $1800
 *
 * @param {number} price - Item price in USD
 * @returns {number} - Fee percentage (0.10 to 0.1305)
 */
function calculateFeePercentage(price) {
    // Clamp price to valid range
    const clampedPrice = Math.min(Math.max(price, MIN_PRICE), MAX_PRICE);

    // Calculate scaled fee percentage
    const priceRatio = (clampedPrice - MIN_PRICE) / (MAX_PRICE - MIN_PRICE);
    const feePercent = MIN_FEE + (priceRatio * (MAX_FEE - MIN_FEE));

    return feePercent;
}

/**
 * Calculate what seller receives from a buyer's payment
 * This is the price after Steam takes their fee
 *
 * @param {number} buyerPrice - Price the buyer pays
 * @returns {object} - { seller_receives, fee_amount, fee_percent, buyer_pays }
 */
function calculateSellerReceives(buyerPrice) {
    const feePercent = calculateFeePercentage(buyerPrice);
    const feeAmount = buyerPrice * feePercent;
    const sellerReceives = buyerPrice - feeAmount;

    return {
        buyer_pays: parseFloat(buyerPrice.toFixed(2)),
        seller_receives: parseFloat(sellerReceives.toFixed(2)),
        fee_amount: parseFloat(feeAmount.toFixed(2)),
        fee_percent: parseFloat((feePercent * 100).toFixed(2))
    };
}

/**
 * Calculate what buyer needs to pay for seller to receive target amount
 * This reverses the fee calculation
 *
 * @param {number} targetSellerAmount - Amount seller wants to receive
 * @returns {object} - { seller_receives, fee_amount, fee_percent, buyer_pays }
 */
function calculateBuyerPrice(targetSellerAmount) {
    // Use iterative approach since fee depends on buyer price
    let buyerPrice = targetSellerAmount / (1 - MIN_FEE); // Initial estimate
    let iterations = 0;
    const maxIterations = 10;

    while (iterations < maxIterations) {
        const result = calculateSellerReceives(buyerPrice);

        if (Math.abs(result.seller_receives - targetSellerAmount) < 0.01) {
            return result;
        }

        // Adjust buyer price
        const difference = targetSellerAmount - result.seller_receives;
        buyerPrice += difference;
        iterations++;
    }

    // Final calculation
    return calculateSellerReceives(buyerPrice);
}

/**
 * Calculate fee breakdown for a transaction
 * Provides detailed breakdown of where money goes
 *
 * @param {number} buyerPrice - Price the buyer pays
 * @returns {object} - Detailed fee breakdown
 */
function getFeeBreakdown(buyerPrice) {
    const result = calculateSellerReceives(buyerPrice);

    // Steam takes the fee (typically split: 5% Steam, ~8% game publisher)
    // But we calculate total fee
    const steamFee = result.fee_amount * 0.5; // Approximate Steam's cut
    const publisherFee = result.fee_amount * 0.5; // Approximate publisher's cut

    return {
        ...result,
        breakdown: {
            steam_fee: parseFloat(steamFee.toFixed(2)),
            publisher_fee: parseFloat(publisherFee.toFixed(2)),
            total_fee: result.fee_amount
        }
    };
}

/**
 * Apply Steam fee to a price (subtract fee)
 * Convenience function
 *
 * @param {number} buyerPrice - Price the buyer pays
 * @returns {number} - Amount seller receives
 */
function applyFee(buyerPrice) {
    const result = calculateSellerReceives(buyerPrice);
    return result.seller_receives;
}

/**
 * Remove Steam fee from a price (add fee back)
 * Use this to calculate buyer price from seller amount
 *
 * @param {number} sellerAmount - Amount seller wants to receive
 * @returns {number} - Amount buyer needs to pay
 */
function removeFee(sellerAmount) {
    const result = calculateBuyerPrice(sellerAmount);
    return result.buyer_pays;
}

/**
 * Calculate profit after Steam fees
 * For investment calculations
 *
 * @param {number} buyPrice - Original purchase price
 * @param {number} currentMarketPrice - Current market listing price (what buyer pays)
 * @returns {object} - Profit calculation
 */
function calculateProfit(buyPrice, currentMarketPrice) {
    const sellerReceivesNow = applyFee(currentMarketPrice);
    const profit = sellerReceivesNow - buyPrice;
    const profitPercent = buyPrice > 0 ? (profit / buyPrice) * 100 : 0;

    return {
        buy_price: parseFloat(buyPrice.toFixed(2)),
        current_market_price: parseFloat(currentMarketPrice.toFixed(2)),
        seller_receives_after_fee: parseFloat(sellerReceivesNow.toFixed(2)),
        profit: parseFloat(profit.toFixed(2)),
        profit_percent: parseFloat(profitPercent.toFixed(2)),
        fee_info: calculateSellerReceives(currentMarketPrice)
    };
}

/**
 * Get fee examples at different price points
 * Useful for documentation/testing
 *
 * @returns {array} - Array of fee examples
 */
function getFeeExamples() {
    const examples = [0.20, 1, 5, 10, 25, 50, 100, 250, 500, 1000, 1800];

    return examples.map(price => ({
        buyer_pays: price,
        ...calculateSellerReceives(price)
    }));
}

/**
 * Validate price is within Steam's acceptable range
 *
 * @param {number} price - Price to validate
 * @returns {object} - { valid, message }
 */
function validatePrice(price) {
    if (price < 0.03) {
        return {
            valid: false,
            message: 'Price must be at least $0.03 (Steam minimum)'
        };
    }

    if (price > 2000) {
        return {
            valid: false,
            message: 'Price exceeds Steam market maximum ($2000)'
        };
    }

    return {
        valid: true,
        message: 'Price is valid'
    };
}

module.exports = {
    calculateFeePercentage,
    calculateSellerReceives,
    calculateBuyerPrice,
    getFeeBreakdown,
    applyFee,
    removeFee,
    calculateProfit,
    getFeeExamples,
    validatePrice,
    // Constants
    MIN_PRICE,
    MAX_PRICE,
    MIN_FEE,
    MAX_FEE
};
