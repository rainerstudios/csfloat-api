#!/usr/bin/env node

/**
 * Price History Snapshot Job
 *
 * Records hourly snapshots of market prices from price_cache into price_history
 * for market trend analysis (24h/7d/30d price changes, pump detection, etc.)
 *
 * Runs: Every hour via cron
 * Schedule: 0 * * * *
 */

const { Pool } = require('pg');

// Simple logger (Winston v2.4.7 has breaking changes)
const logger = {
    info: (msg) => console.log(`[INFO] ${new Date().toISOString()} - ${msg}`),
    error: (msg) => console.error(`[ERROR] ${new Date().toISOString()} - ${msg}`),
    warn: (msg) => console.warn(`[WARN] ${new Date().toISOString()} - ${msg}`)
};

// Database connection
const pool = new Pool({
    host: '178.156.147.69',
    port: 5432,
    user: 'cs2user',
    password: 'cs2pass123',
    database: 'cs2floatapi',
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
});

/**
 * Parse price from JSONB structure
 */
function parsePrice(priceData, marketplace) {
    if (!priceData || !priceData.prices || !priceData.prices[marketplace]) {
        return null;
    }

    const marketData = priceData.prices[marketplace];

    // Different markets store prices differently
    if (marketplace === 'buff163') {
        return marketData.price_usd || null;
    } else if (marketplace === 'skinport') {
        return marketData.price_usd || null;
    } else if (marketplace === 'marketCsgo') {
        return marketData.price_usd || null;
    } else {
        return marketData.price_usd || null;
    }
}

/**
 * Record price snapshot for a single item
 */
async function recordItemSnapshot(itemName, priceData) {
    try {
        const steamPrice = parsePrice(priceData, 'steam');
        const buff163Price = parsePrice(priceData, 'buff163');
        const csfloatPrice = parsePrice(priceData, 'csfloat');
        const skinportPrice = parsePrice(priceData, 'skinport');
        const csdealsPrice = parsePrice(priceData, 'marketCsgo'); // marketCsgo is cs.deals

        // Get lowest and highest from priceData
        const lowestPrice = priceData.lowestPrice || null;
        const highestPrice = priceData.highestPrice || null;

        // Get listings counts
        const buff163Listings = priceData.prices?.buff163?.listings || null;
        const csfloatListings = priceData.prices?.csfloat?.listings || null;
        const skinportListings = priceData.prices?.skinport?.listings || null;

        // Only record if we have at least one price
        const hasPrices = [steamPrice, buff163Price, csfloatPrice, skinportPrice, csdealsPrice]
            .some(price => price !== null && price > 0);

        if (!hasPrices) {
            logger.warn(`No valid prices for ${itemName}, skipping snapshot`);
            return false;
        }

        // Get previous snapshot to calculate volume (24h ago)
        const previousSnapshot = await pool.query(`
            SELECT buff163_listings, csfloat_listings, skinport_listings
            FROM price_history
            WHERE item_name = $1
            AND recorded_at >= NOW() - INTERVAL '25 hours'
            AND recorded_at <= NOW() - INTERVAL '23 hours'
            ORDER BY recorded_at DESC
            LIMIT 1
        `, [itemName]);

        // Calculate volume (listings decreased = items sold)
        let volume24h = 0;
        if (previousSnapshot.rows.length > 0) {
            const prev = previousSnapshot.rows[0];

            // Sum up listing decreases (items sold) across all marketplaces
            if (prev.buff163_listings && buff163Listings) {
                const diff = prev.buff163_listings - buff163Listings;
                if (diff > 0) volume24h += diff;
            }
            if (prev.csfloat_listings && csfloatListings) {
                const diff = prev.csfloat_listings - csfloatListings;
                if (diff > 0) volume24h += diff;
            }
            if (prev.skinport_listings && skinportListings) {
                const diff = prev.skinport_listings - skinportListings;
                if (diff > 0) volume24h += diff;
            }
        }

        await pool.query(`
            INSERT INTO price_history (
                item_name,
                steam_price,
                buff163_price,
                csfloat_price,
                skinport_price,
                csdeals_price,
                lowest_price,
                highest_price,
                buff163_listings,
                csfloat_listings,
                skinport_listings,
                volume_24h,
                recorded_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
        `, [
            itemName,
            steamPrice,
            buff163Price,
            csfloatPrice,
            skinportPrice,
            csdealsPrice,
            lowestPrice,
            highestPrice,
            buff163Listings,
            csfloatListings,
            skinportListings,
            volume24h
        ]);

        return true;
    } catch (error) {
        logger.error(`Failed to record snapshot for ${itemName}: ${error.message}`);
        return false;
    }
}

/**
 * Main job function
 */
async function runPriceHistorySnapshot() {
    const startTime = Date.now();
    logger.info('Starting price history snapshot job');

    try {
        // Get all items from price_cache
        const result = await pool.query(`
            SELECT market_hash_name, price_data, cached_at
            FROM price_cache
            ORDER BY market_hash_name
        `);

        logger.info(`Found ${result.rows.length} items in price_cache`);

        let successCount = 0;
        let failedCount = 0;

        for (const row of result.rows) {
            const itemName = row.market_hash_name;
            const priceData = row.price_data;

            const success = await recordItemSnapshot(itemName, priceData);

            if (success) {
                successCount++;
            } else {
                failedCount++;
            }
        }

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        logger.info(`Price history snapshot completed in ${duration}s`);
        logger.info(`Success: ${successCount}, Failed: ${failedCount}, Total: ${result.rows.length}`);

        // Clean up old history (keep last 90 days)
        const cleanupResult = await pool.query(`
            DELETE FROM price_history
            WHERE recorded_at < NOW() - INTERVAL '90 days'
        `);

        if (cleanupResult.rowCount > 0) {
            logger.info(`Cleaned up ${cleanupResult.rowCount} old price history records (>90 days)`);
        }

        return {
            success: true,
            totalItems: result.rows.length,
            successCount,
            failedCount,
            duration
        };

    } catch (error) {
        logger.error(`Price history snapshot job failed: ${error.message}`);
        logger.error(error.stack);
        throw error;
    }
}

/**
 * Execute job and exit
 */
if (require.main === module) {
    runPriceHistorySnapshot()
        .then(result => {
            logger.info('Job completed successfully');
            process.exit(0);
        })
        .catch(error => {
            logger.error('Job failed');
            process.exit(1);
        })
        .finally(() => {
            pool.end();
        });
}

module.exports = { runPriceHistorySnapshot };
