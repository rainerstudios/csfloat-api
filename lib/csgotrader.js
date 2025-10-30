/**
 * CSGOTrader API Integration
 * Fetch prices from multiple marketplaces via CSGOTrader price API
 * Based on SkinWatch implementation patterns
 */

const fetch = require('node-fetch');
const { v4: uuidv4 } = require('uuid');

const BASE_URL = 'https://prices.csgotrader.app/latest';

const MARKETPLACES = [
    {
        name: 'steam',
        url: `${BASE_URL}/steam.json`,
        batchSize: 1500,
        timeout: 30000,
        dbChunkSize: 1000
    },
    {
        name: 'csfloat',
        url: `${BASE_URL}/csfloat.json`,
        batchSize: 1500,
        timeout: 30000,
        dbChunkSize: 1000
    },
    {
        name: 'skinport',
        url: `${BASE_URL}/skinport.json`,
        batchSize: 1000,
        timeout: 35000,
        dbChunkSize: 600
    },
    {
        name: 'buff163',
        url: `${BASE_URL}/buff163.json`,
        batchSize: 800,
        timeout: 70000,
        dbChunkSize: 400
    }
];

/**
 * Fetch prices from a specific marketplace
 * @param {string} marketplaceName - Marketplace name (steam, csfloat, etc.)
 * @returns {object} - Price data
 */
async function fetchMarketplacePrices(marketplaceName) {
    const marketplace = MARKETPLACES.find(m => m.name === marketplaceName);

    if (!marketplace) {
        throw new Error(`Unknown marketplace: ${marketplaceName}`);
    }

    console.log(`Fetching prices from ${marketplace.name}...`);

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), marketplace.timeout);

        const response = await fetch(marketplace.url, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'CSFloat-Investment-Tracker/1.0'
            }
        });

        clearTimeout(timeout);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        console.log(`Fetched ${Object.keys(data).length} items from ${marketplace.name}`);

        return { success: true, data, marketplace: marketplace.name };
    } catch (error) {
        console.error(`Failed to fetch ${marketplace.name}:`, error.message);
        return { success: false, error: error.message, marketplace: marketplace.name };
    }
}

/**
 * Update database with fetched prices
 * @param {object} postgres - PostgreSQL client
 * @param {string} marketplaceName - Marketplace name
 * @param {object} priceData - Price data from API
 * @param {string} runId - UUID for this update run
 */
async function updateDatabasePrices(postgres, marketplaceName, priceData, runId) {
    const marketplace = MARKETPLACES.find(m => m.name === marketplaceName);
    const items = Object.entries(priceData);

    console.log(`Updating ${items.length} prices for ${marketplaceName}...`);

    let inserted = 0;
    let updated = 0;
    let errors = 0;

    // Process in chunks
    const chunkSize = marketplace.dbChunkSize;
    for (let i = 0; i < items.length; i += chunkSize) {
        const chunk = items.slice(i, i + chunkSize);

        for (const [itemName, priceInfo] of chunk) {
            try {
                // Extract price data
                const price = typeof priceInfo === 'number' ? priceInfo : priceInfo.price;
                const startingAt = priceInfo.starting_at || null;
                const highestOrder = priceInfo.highest_order || null;
                const last24h = priceInfo.last_24h || null;
                const last7d = priceInfo.last_7d || null;
                const last30d = priceInfo.last_30d || null;
                const last90d = priceInfo.last_90d || null;

                // Skip if no valid price
                if (!price || price <= 0) {
                    continue;
                }

                // Upsert into database
                const result = await postgres.query(`
                    INSERT INTO marketplace_prices (
                        item_name, marketplace, price,
                        starting_at, highest_order,
                        last_24h, last_7d, last_30d, last_90d,
                        run_id, updated_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
                    ON CONFLICT (item_name, marketplace)
                    DO UPDATE SET
                        price = EXCLUDED.price,
                        starting_at = EXCLUDED.starting_at,
                        highest_order = EXCLUDED.highest_order,
                        last_24h = EXCLUDED.last_24h,
                        last_7d = EXCLUDED.last_7d,
                        last_30d = EXCLUDED.last_30d,
                        last_90d = EXCLUDED.last_90d,
                        run_id = EXCLUDED.run_id,
                        updated_at = NOW()
                    RETURNING (xmax = 0) AS inserted
                `, [
                    itemName,
                    marketplaceName,
                    price,
                    JSON.stringify(startingAt),
                    JSON.stringify(highestOrder),
                    last24h,
                    last7d,
                    last30d,
                    last90d,
                    runId
                ]);

                if (result.rows[0].inserted) {
                    inserted++;
                } else {
                    updated++;
                }
            } catch (error) {
                console.error(`Error updating ${itemName}:`, error.message);
                errors++;
            }
        }

        // Log progress
        const progress = Math.min(i + chunkSize, items.length);
        console.log(`  Progress: ${progress}/${items.length} (${((progress/items.length)*100).toFixed(1)}%)`);
    }

    return { inserted, updated, errors, total: items.length };
}

/**
 * Cleanup old prices not in current run
 * @param {object} postgres - PostgreSQL client
 * @param {string} runId - Current run ID
 */
async function cleanupOldPrices(postgres, runId) {
    const result = await postgres.query(`
        DELETE FROM marketplace_prices
        WHERE run_id != $1
        AND updated_at < NOW() - INTERVAL '7 days'
    `, [runId]);

    console.log(`Cleaned up ${result.rowCount} stale price entries`);
    return result.rowCount;
}

/**
 * Update all marketplace prices
 * @param {object} postgres - PostgreSQL client
 * @param {array} marketplaces - Array of marketplace names (optional)
 */
async function updateAllPrices(postgres, marketplaces = null) {
    const runId = uuidv4();
    const startTime = Date.now();

    console.log(`\n=== Starting price update run: ${runId} ===\n`);

    const marketplacesToUpdate = marketplaces ||
        MARKETPLACES.map(m => m.name);

    const results = {
        runId,
        startTime: new Date(startTime).toISOString(),
        marketplaces: {}
    };

    // Fetch and update each marketplace
    for (const marketplaceName of marketplacesToUpdate) {
        const fetchResult = await fetchMarketplacePrices(marketplaceName);

        if (fetchResult.success) {
            const updateResult = await updateDatabasePrices(
                postgres,
                marketplaceName,
                fetchResult.data,
                runId
            );

            results.marketplaces[marketplaceName] = {
                success: true,
                ...updateResult
            };
        } else {
            results.marketplaces[marketplaceName] = {
                success: false,
                error: fetchResult.error
            };
        }
    }

    // Cleanup old prices
    const cleaned = await cleanupOldPrices(postgres, runId);
    results.cleanedUp = cleaned;

    const duration = Date.now() - startTime;
    results.duration = duration;
    results.endTime = new Date().toISOString();

    console.log(`\n=== Price update completed in ${(duration/1000).toFixed(2)}s ===\n`);

    return results;
}

/**
 * Get price update status
 * @param {object} postgres - PostgreSQL client
 */
async function getPriceUpdateStatus(postgres) {
    const result = await postgres.query(`
        SELECT
            marketplace,
            COUNT(*) as item_count,
            MAX(updated_at) as last_updated,
            MIN(updated_at) as oldest_update
        FROM marketplace_prices
        GROUP BY marketplace
        ORDER BY marketplace
    `);

    return result.rows;
}

/**
 * Detect price changes and track them
 * @param {object} postgres - PostgreSQL client
 * @param {number} thresholdPercent - Minimum change % to track (default: 5%)
 */
async function detectPriceChanges(postgres, thresholdPercent = 5) {
    // This requires price history, so we'll query items that have changed significantly
    const result = await postgres.query(`
        WITH current_prices AS (
            SELECT item_name, marketplace, price, updated_at
            FROM marketplace_prices
            WHERE updated_at > NOW() - INTERVAL '1 hour'
        ),
        previous_prices AS (
            SELECT item_name, marketplace, last_24h as price
            FROM marketplace_prices
            WHERE last_24h IS NOT NULL
        )
        SELECT
            c.item_name,
            c.marketplace,
            p.price as old_price,
            c.price as new_price,
            ((c.price - p.price) / p.price * 100) as change_percent
        FROM current_prices c
        JOIN previous_prices p ON c.item_name = p.item_name AND c.marketplace = p.marketplace
        WHERE ABS((c.price - p.price) / p.price * 100) >= $1
        ORDER BY ABS((c.price - p.price) / p.price) DESC
        LIMIT 100
    `, [thresholdPercent]);

    // Track significant changes
    for (const change of result.rows) {
        await postgres.query(`
            INSERT INTO price_change_tracking (
                item_name, marketplace, old_price, new_price, change_percent
            ) VALUES ($1, $2, $3, $4, $5)
        `, [
            change.item_name,
            change.marketplace,
            change.old_price,
            change.new_price,
            change.change_percent
        ]);
    }

    return result.rows;
}

module.exports = {
    fetchMarketplacePrices,
    updateDatabasePrices,
    updateAllPrices,
    cleanupOldPrices,
    getPriceUpdateStatus,
    detectPriceChanges,
    MARKETPLACES
};
