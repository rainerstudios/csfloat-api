/**
 * Portfolio Tracking API Endpoints
 * Add these to your index.js file
 *
 * Usage: Copy the functions below and add them to your index.js after line 1093
 */

const winston = require('winston');

// ============================================================================
// PORTFOLIO MANAGEMENT ENDPOINTS
// ============================================================================

/**
 * Add new investment to portfolio
 * POST /api/portfolio/add
 */
app.post('/api/portfolio/add', async (req, res) => {
    try {
        const {
            userId,
            itemName,
            purchasePrice,
            quantity = 1,
            inspectLink,
            marketplace = 'Steam',
            notes
        } = req.body;

        if (!userId || !itemName || !purchasePrice) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: userId, itemName, purchasePrice'
            });
        }

        let floatData = null;
        let rarityData = null;
        let priceData = null;
        let investmentScore = null;

        // If inspect link provided, fetch float data
        if (inspectLink) {
            try {
                // Use existing bulk endpoint to get float data
                const InspectURL = require('./lib/inspect_url');
                const link = new InspectURL(inspectLink);

                if (link.valid) {
                    const itemData = await postgres.getItemData([link]);
                    if (itemData.length > 0) {
                        floatData = itemData[0];
                    }
                }
            } catch (e) {
                winston.warn(`Failed to fetch float data: ${e.message}`);
            }
        }

        // Get rarity data if we have float data
        if (floatData) {
            try {
                rarityData = await postgres.getFloatRarity(
                    floatData.defindex,
                    floatData.paintindex,
                    floatData.floatvalue
                );
            } catch (e) {
                winston.warn(`Failed to get rarity data: ${e.message}`);
            }
        }

        // Get current price data
        try {
            priceData = await postgres.getCachedPrice(itemName);
        } catch (e) {
            winston.warn(`Failed to get price data: ${e.message}`);
        }

        // Calculate Investment Score if we have enough data
        if (rarityData && priceData) {
            try {
                investmentScore = calculateInvestmentScore({
                    floatRarity: rarityData.rarityScore || 50,
                    patternIndex: floatData?.paintseed || 0,
                    itemName: itemName,
                    liquidity: priceData.prices?.csfloat?.listings || 0,
                    currentPrice: priceData.lowestPrice || purchasePrice,
                    defindex: floatData?.defindex || 0,
                    paintindex: floatData?.paintindex || 0
                });
            } catch (e) {
                winston.warn(`Failed to calculate investment score: ${e.message}`);
            }
        }

        // Detect pattern tier (Blue Gems, etc.)
        let patternTier = 'Standard';
        let patternMultiplier = 1.0;
        if (floatData) {
            const patternInfo = await detectPatternTier(itemName, floatData.paintseed);
            patternTier = patternInfo.tier;
            patternMultiplier = patternInfo.multiplier;
        }

        // Insert into database
        const result = await postgres.pool.query(`
            INSERT INTO portfolio_investments (
                user_id, item_name, purchase_price, quantity, marketplace,
                float_value, pattern_index, defindex, paintindex,
                wear, is_stattrak,
                investment_score, investment_score_breakdown,
                float_rarity_score, pattern_tier, pattern_value_multiplier,
                stickers, notes
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
            RETURNING id
        `, [
            userId,
            itemName,
            purchasePrice,
            quantity,
            marketplace,
            floatData?.floatvalue || null,
            floatData?.paintseed || null,
            floatData?.defindex || null,
            floatData?.paintindex || null,
            floatData ? getWearFromFloat(floatData.floatvalue) : null,
            floatData?.killeatervalue !== null,
            investmentScore?.overall || null,
            investmentScore ? JSON.stringify(investmentScore.breakdown) : null,
            rarityData?.rarityScore || null,
            patternTier,
            patternMultiplier,
            floatData?.stickers ? JSON.stringify(floatData.stickers) : null,
            notes || null
        ]);

        res.json({
            success: true,
            investment: {
                id: result.rows[0].id,
                itemName: itemName,
                purchasePrice: purchasePrice,
                floatValue: floatData?.floatvalue || null,
                investmentScore: investmentScore?.overall || null,
                patternTier: patternTier,
                rarityTier: rarityData?.rarityTier || null
            }
        });

    } catch (e) {
        winston.error('Error adding portfolio investment:', e);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

/**
 * Get user portfolio
 * GET /api/portfolio/:userId
 */
app.get('/api/portfolio/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;

        if (!userId) {
            return res.status(400).json({
                success: false,
                error: 'Missing userId'
            });
        }

        // Get all investments
        const result = await postgres.pool.query(`
            SELECT
                pi.*,
                COALESCE(SUM(ps.quantity), 0) as sold_quantity,
                COALESCE(SUM(ps.profit_loss), 0) as realized_profit
            FROM portfolio_investments pi
            LEFT JOIN portfolio_sales ps ON pi.id = ps.investment_id
            WHERE pi.user_id = $1
            GROUP BY pi.id
            ORDER BY pi.created_at DESC
        `, [userId]);

        const investments = result.rows;

        // Enrich with current prices
        for (const inv of investments) {
            try {
                const priceData = await postgres.getCachedPrice(inv.item_name);
                inv.current_price = priceData?.lowestPrice || 0;

                // Calculate unrealized profit
                const remaining = inv.quantity - inv.sold_quantity;
                inv.unrealized_profit = (inv.current_price - inv.purchase_price) * remaining;
                inv.unrealized_roi = inv.purchase_price > 0
                    ? ((inv.unrealized_profit / (inv.purchase_price * remaining)) * 100)
                    : 0;

                // Total profit
                inv.total_profit = parseFloat(inv.realized_profit) + inv.unrealized_profit;
            } catch (e) {
                winston.warn(`Failed to get price for ${inv.item_name}:`, e.message);
                inv.current_price = 0;
                inv.unrealized_profit = 0;
                inv.unrealized_roi = 0;
            }
        }

        res.json({
            success: true,
            investments: investments
        });

    } catch (e) {
        winston.error('Error fetching portfolio:', e);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

/**
 * Get portfolio statistics
 * GET /api/portfolio/stats/:userId
 */
app.get('/api/portfolio/stats/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;

        // Get investments with sales
        const result = await postgres.pool.query(`
            SELECT
                pi.id,
                pi.item_name,
                pi.purchase_price,
                pi.quantity,
                pi.investment_score,
                COALESCE(SUM(ps.quantity), 0) as sold_quantity,
                COALESCE(SUM(ps.profit_loss), 0) as realized_profit
            FROM portfolio_investments pi
            LEFT JOIN portfolio_sales ps ON pi.id = ps.investment_id
            WHERE pi.user_id = $1
            GROUP BY pi.id
        `, [userId]);

        const investments = result.rows;

        let totalInvested = 0;
        let currentValue = 0;
        let realizedProfit = 0;
        let itemCount = investments.length;
        let avgInvestmentScore = 0;

        // Calculate stats
        for (const inv of investments) {
            totalInvested += parseFloat(inv.purchase_price) * inv.quantity;
            realizedProfit += parseFloat(inv.realized_profit);

            // Get current price
            try {
                const priceData = await postgres.getCachedPrice(inv.item_name);
                const remaining = inv.quantity - inv.sold_quantity;
                currentValue += (priceData?.lowestPrice || 0) * remaining;
            } catch (e) {
                winston.warn(`Failed to get price for ${inv.item_name}`);
            }

            avgInvestmentScore += inv.investment_score || 0;
        }

        avgInvestmentScore = itemCount > 0 ? avgInvestmentScore / itemCount : 0;

        const unrealizedProfit = currentValue - totalInvested + realizedProfit;
        const totalProfit = realizedProfit + unrealizedProfit;
        const totalROI = totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0;

        res.json({
            success: true,
            stats: {
                totalInvested: parseFloat(totalInvested.toFixed(2)),
                currentValue: parseFloat(currentValue.toFixed(2)),
                realizedProfit: parseFloat(realizedProfit.toFixed(2)),
                unrealizedProfit: parseFloat(unrealizedProfit.toFixed(2)),
                totalProfit: parseFloat(totalProfit.toFixed(2)),
                totalROI: parseFloat(totalROI.toFixed(2)),
                itemCount: itemCount,
                avgInvestmentScore: parseFloat(avgInvestmentScore.toFixed(1))
            }
        });

    } catch (e) {
        winston.error('Error calculating portfolio stats:', e);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

/**
 * Record a sale
 * POST /api/portfolio/sale
 */
app.post('/api/portfolio/sale', async (req, res) => {
    try {
        const {
            investmentId,
            quantity,
            salePrice,
            marketplace = 'Steam',
            notes
        } = req.body;

        if (!investmentId || !quantity || !salePrice) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: investmentId, quantity, salePrice'
            });
        }

        // Get investment
        const invResult = await postgres.pool.query(`
            SELECT * FROM portfolio_investments WHERE id = $1
        `, [investmentId]);

        if (invResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Investment not found'
            });
        }

        const investment = invResult.rows[0];

        // Calculate profit/loss
        const profitLoss = (salePrice - investment.purchase_price) * quantity;
        const roiPercent = ((salePrice - investment.purchase_price) / investment.purchase_price) * 100;

        // Insert sale record
        await postgres.pool.query(`
            INSERT INTO portfolio_sales (
                investment_id, user_id, quantity, sale_price,
                marketplace, profit_loss, roi_percent, notes
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
            investmentId,
            investment.user_id,
            quantity,
            salePrice,
            marketplace,
            profitLoss,
            roiPercent,
            notes || null
        ]);

        // Check if fully sold
        const salesResult = await postgres.pool.query(`
            SELECT SUM(quantity) as total_sold
            FROM portfolio_sales
            WHERE investment_id = $1
        `, [investmentId]);

        const totalSold = parseInt(salesResult.rows[0].total_sold);

        if (totalSold >= investment.quantity) {
            // Mark as fully sold
            await postgres.pool.query(`
                UPDATE portfolio_investments
                SET is_sold = true, updated_at = NOW()
                WHERE id = $1
            `, [investmentId]);
        }

        res.json({
            success: true,
            sale: {
                investmentId: investmentId,
                quantity: quantity,
                salePrice: salePrice,
                profitLoss: parseFloat(profitLoss.toFixed(2)),
                roiPercent: parseFloat(roiPercent.toFixed(2)),
                isFullySold: totalSold >= investment.quantity
            }
        });

    } catch (e) {
        winston.error('Error recording sale:', e);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

/**
 * Delete investment
 * DELETE /api/portfolio/delete/:investmentId
 */
app.delete('/api/portfolio/delete/:investmentId', async (req, res) => {
    try {
        const investmentId = req.params.investmentId;

        // Delete investment (CASCADE will delete associated sales)
        const result = await postgres.pool.query(`
            DELETE FROM portfolio_investments
            WHERE id = $1
            RETURNING id
        `, [investmentId]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Investment not found'
            });
        }

        res.json({
            success: true,
            message: 'Investment deleted successfully'
        });

    } catch (e) {
        winston.error('Error deleting investment:', e);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// ============================================================================
// INVESTMENT SCORING SYSTEM
// ============================================================================

/**
 * Calculate Investment Score for an item
 * POST /api/investment-score
 */
app.post('/api/investment-score', async (req, res) => {
    try {
        const { itemName, floatValue, patternIndex, defindex, paintindex } = req.body;

        if (!itemName || floatValue === undefined) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: itemName, floatValue'
            });
        }

        // 1. Get float rarity
        let rarityData = null;
        if (defindex && paintindex) {
            rarityData = await postgres.getFloatRarity(defindex, paintindex, floatValue);
        }

        // 2. Get current prices
        const priceData = await postgres.getCachedPrice(itemName);

        // 3. Calculate Investment Score
        const score = await calculateInvestmentScore({
            floatRarity: rarityData?.rarityScore || 50,
            patternIndex: patternIndex || 0,
            itemName: itemName,
            liquidity: priceData?.prices?.csfloat?.listings || 0,
            currentPrice: priceData?.lowestPrice || 0,
            defindex: defindex || 0,
            paintindex: paintindex || 0
        });

        // 4. Get pattern info
        const patternInfo = await detectPatternTier(itemName, patternIndex || 0);

        res.json({
            success: true,
            itemName: itemName,
            floatValue: floatValue,
            investmentScore: score,
            patternInfo: patternInfo,
            rarityInfo: rarityData || null
        });

    } catch (e) {
        winston.error('Error calculating investment score:', e);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate Investment Score (1-10 scale)
 */
async function calculateInvestmentScore(data) {
    const {
        floatRarity,      // 0-100 from getFloatRarity()
        patternIndex,
        itemName,
        liquidity,
        currentPrice,
        defindex,
        paintindex
    } = data;

    // 1. Float Rarity Score (25%)
    const floatScore = floatRarity / 10; // Convert 0-100 to 0-10

    // 2. Pattern Value Score (20%)
    const patternInfo = await detectPatternTier(itemName, patternIndex);
    const patternScore = patternInfo.score;

    // 3. Liquidity Score (20%)
    const liquidityScore = calculateLiquidityScore(liquidity);

    // 4. Weapon Popularity Score (15%)
    const weaponScore = getWeaponPopularity(itemName);

    // 5. Price Trend Score (15%)
    const trendScore = await calculatePriceTrend(itemName);

    // 6. Volatility Score (10%)
    const volatilityScore = await calculateVolatility(itemName);

    // Weighted average
    const overall = (
        floatScore * 0.25 +
        patternScore * 0.20 +
        liquidityScore * 0.20 +
        weaponScore * 0.15 +
        trendScore * 0.15 +
        volatilityScore * 0.10
    );

    return {
        overall: Math.round(overall * 10) / 10,
        breakdown: {
            float_rarity: parseFloat(floatScore.toFixed(1)),
            pattern_value: parseFloat(patternScore.toFixed(1)),
            liquidity: parseFloat(liquidityScore.toFixed(1)),
            weapon_popularity: parseFloat(weaponScore.toFixed(1)),
            price_trend: parseFloat(trendScore.toFixed(1)),
            volatility: parseFloat(volatilityScore.toFixed(1))
        }
    };
}

/**
 * Detect pattern tier (Blue Gems, Fade, Doppler, etc.)
 */
async function detectPatternTier(itemName, patternIndex) {
    // Check Blue Gem database
    if (itemName.includes('Case Hardened')) {
        const result = await postgres.pool.query(`
            SELECT tier, blue_percentage, value_multiplier, description
            FROM blue_gem_patterns
            WHERE weapon_type = $1 AND pattern_index = $2
        `, ['AK-47', patternIndex]); // TODO: Extract weapon type from itemName

        if (result.rows.length > 0) {
            const pattern = result.rows[0];
            return {
                tier: pattern.tier,
                multiplier: parseFloat(pattern.value_multiplier),
                description: pattern.description,
                score: getTierScore(pattern.tier)
            };
        }
    }

    // TODO: Add Fade, Doppler, Crimson Web detection

    return {
        tier: 'Standard',
        multiplier: 1.0,
        description: 'Standard pattern',
        score: 5.0
    };
}

function getTierScore(tier) {
    if (tier === 'Tier 1') return 10.0;
    if (tier === 'Tier 2') return 9.0;
    if (tier === 'Tier 3') return 8.0;
    return 5.0;
}

/**
 * Calculate liquidity score based on number of listings
 */
function calculateLiquidityScore(listings) {
    if (listings > 1000) return 10.0;
    if (listings > 500) return 9.0;
    if (listings > 100) return 7.5;
    if (listings > 50) return 6.0;
    if (listings > 10) return 4.0;
    return 2.0;
}

/**
 * Get weapon popularity score
 */
function getWeaponPopularity(itemName) {
    const sWeapons = ['Knife', 'Karambit', 'Butterfly', 'M9', 'Bayonet',
                      'AK-47', 'M4A4', 'M4A1-S', 'AWP', 'Gloves'];
    const aWeapons = ['Desert Eagle', 'USP-S', 'Glock-18', 'P250'];
    const bWeapons = ['Galil AR', 'FAMAS', 'Five-SeveN', 'CZ75-Auto'];

    if (sWeapons.some(w => itemName.includes(w))) return 10.0;
    if (aWeapons.some(w => itemName.includes(w))) return 8.0;
    if (bWeapons.some(w => itemName.includes(w))) return 6.0;
    return 4.0;
}

/**
 * Calculate price trend score from historical data
 */
async function calculatePriceTrend(itemName) {
    try {
        const history = await postgres.getPriceHistory(itemName, 30);

        if (history.length < 7) return 5.0;

        const recentPrice = history[0]?.price_usd || 0;
        const oldPrice = history[history.length - 1]?.price_usd || 0;

        if (oldPrice === 0) return 5.0;

        const percentChange = ((recentPrice - oldPrice) / oldPrice) * 100;

        // Score based on trend direction
        if (percentChange > 30) return 10.0; // Strong uptrend
        if (percentChange > 15) return 8.5;
        if (percentChange > 5) return 7.0;
        if (percentChange > -5) return 5.0; // Flat
        if (percentChange > -15) return 3.0;
        return 1.0; // Strong downtrend
    } catch (e) {
        winston.warn(`Failed to calculate price trend for ${itemName}:`, e.message);
        return 5.0; // Default neutral score
    }
}

/**
 * Calculate volatility score (lower volatility = higher score)
 */
async function calculateVolatility(itemName) {
    try {
        const history = await postgres.getPriceHistory(itemName, 30);

        if (history.length < 7) return 5.0;

        const prices = history.map(h => h.price_usd || 0).filter(p => p > 0);
        if (prices.length === 0) return 5.0;

        const mean = prices.reduce((a, b) => a + b, 0) / prices.length;

        const variance = prices.reduce((sum, price) => {
            return sum + Math.pow(price - mean, 2);
        }, 0) / prices.length;

        const stdDev = Math.sqrt(variance);
        const cv = (stdDev / mean) * 100; // Coefficient of variation

        // Lower CV = more stable = higher score
        if (cv < 5) return 10.0;  // Very stable
        if (cv < 10) return 8.0;
        if (cv < 20) return 6.0;
        if (cv < 30) return 4.0;
        return 2.0; // Very volatile
    } catch (e) {
        winston.warn(`Failed to calculate volatility for ${itemName}:`, e.message);
        return 5.0;
    }
}

/**
 * Get wear from float value
 */
function getWearFromFloat(floatValue) {
    if (floatValue < 0.07) return 'FN';
    if (floatValue < 0.15) return 'MW';
    if (floatValue < 0.38) return 'FT';
    if (floatValue < 0.45) return 'WW';
    return 'BS';
}

// Export functions (if using module.exports)
module.exports = {
    calculateInvestmentScore,
    detectPatternTier,
    calculateLiquidityScore,
    getWeaponPopularity,
    calculatePriceTrend,
    calculateVolatility,
    getWearFromFloat
};

winston.info('Portfolio endpoints loaded successfully');
