#!/usr/bin/env node

/**
 * Daily Price Sync Script
 * Syncs prices from Skin.Broker for all tracked items
 * Run via cron: 0 3 * * * /usr/bin/node /var/www/csfloat-api/sync-prices.js
 */

const winston = require('winston');
const CONFIG = require('./config.js');
const Postgres = require('./lib/postgres');
const gameData = require('./lib/game_data');

winston.level = 'info';

const postgres = new Postgres(CONFIG.database_url, false);
const API_KEY = CONFIG.skinbroker_api_key || 'sbv1eDIL09Ccfvj3KTcgMVTwCKk8echbPWEdX60CgrsLiJl4NGuL';

// Rate limiting: 1000 requests/hour = 1 request per 3.6 seconds
const RATE_LIMIT_MS = 4000; // 4 seconds to be safe

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function syncPricesForItem(marketHashName) {
    try {
        const url = `https://skin.broker/api/v1/item?marketHashName=${encodeURIComponent(marketHashName)}&key=${API_KEY}`;

        const response = await fetch(url);

        if (!response.ok) {
            winston.warn(`Failed to fetch ${marketHashName}: HTTP ${response.status}`);
            return false;
        }

        const data = await response.json();

        if (!data.success) {
            winston.warn(`No data for ${marketHashName}`);
            return false;
        }

        // Store prices for each market
        const markets = [
            { key: 'buff', name: 'buff163' },
            { key: 'skinport', name: 'skinport' },
            { key: 'marketCsgo', name: 'marketcsgo' },
            { key: 'csfloat', name: 'csfloat' },
            { key: 'steam', name: 'steam' }
        ];

        for (const market of markets) {
            if (data.price[market.key]) {
                const priceData = data.price[market.key];
                await postgres.storePriceSnapshot(
                    marketHashName,
                    market.name,
                    priceData.converted.price,
                    priceData.count,
                    {
                        priceOriginal: priceData.original.price,
                        currency: priceData.original.currency
                    }
                );
            }
        }

        winston.info(`✓ Synced prices for ${marketHashName}`);
        return true;

    } catch (e) {
        winston.error(`Error syncing ${marketHashName}:`, e.message);
        return false;
    }
}

async function syncRecentSalesForItem(marketHashName) {
    try {
        const url = `https://skin.broker/api/v1/item/sales?marketHashName=${encodeURIComponent(marketHashName)}&key=${API_KEY}`;

        const response = await fetch(url);

        if (!response.ok) {
            return false;
        }

        const data = await response.json();

        if (!Array.isArray(data) || data.length === 0) {
            return false;
        }

        // Store recent sales (limit to 10 most recent)
        for (const sale of data.slice(0, 10)) {
            await postgres.storeRecentSale(marketHashName, {
                price: sale.price,
                float: sale.float,
                pattern: sale.pattern,
                stickers: sale.stickers,
                date: sale.time,
                market: sale.market.name
            });
        }

        winston.info(`✓ Synced ${data.length} sales for ${marketHashName}`);
        return true;

    } catch (e) {
        winston.error(`Error syncing sales for ${marketHashName}:`, e.message);
        return false;
    }
}

async function getUniqueItemNames() {
    // Get unique items from database
    const result = await postgres.pool.query(`
        SELECT DISTINCT
            defindex,
            paintindex,
            stattrak,
            souvenir,
            props
        FROM items
        ORDER BY defindex, paintindex
        LIMIT 800
    `);

    // Convert to market hash names
    const itemNames = new Set();

    for (const row of result.rows) {
        try {
            // Reconstruct item name from game data
            const item = {
                defindex: row.defindex,
                paintindex: row.paintindex,
                stattrak: row.stattrak,
                souvenir: row.souvenir
            };

            // This requires game data to be loaded
            // For now, we'll query items table for existing full names
        } catch (e) {
            winston.warn(`Failed to process item: ${JSON.stringify(row)}`);
        }
    }

    // Alternative: Get from price_cache table (items already checked)
    const cacheResult = await postgres.pool.query(`
        SELECT DISTINCT market_hash_name
        FROM price_cache
        ORDER BY cached_at DESC
        LIMIT 500
    `);

    for (const row of cacheResult.rows) {
        itemNames.add(row.market_hash_name);
    }

    return Array.from(itemNames);
}

async function main() {
    winston.info('='.repeat(60));
    winston.info('Starting Price Sync...');
    winston.info(`Time: ${new Date().toISOString()}`);
    winston.info('='.repeat(60));

    try {
        await postgres.connect();
        winston.info('✓ Database connected');

        // Get list of items to sync
        const itemNames = await getUniqueItemNames();
        winston.info(`Found ${itemNames.length} unique items to sync`);

        if (itemNames.length === 0) {
            winston.warn('No items found to sync. Price cache may be empty.');
            winston.info('Items will be added as users check floats.');
            process.exit(0);
        }

        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < itemNames.length; i++) {
            const itemName = itemNames[i];

            winston.info(`[${i + 1}/${itemNames.length}] Processing: ${itemName}`);

            // Sync prices
            const priceSuccess = await syncPricesForItem(itemName);
            if (priceSuccess) {
                successCount++;
            } else {
                failCount++;
            }

            // Rate limit
            await sleep(RATE_LIMIT_MS);

            // Sync sales (every 10th item to save API calls)
            if (i % 10 === 0) {
                await syncRecentSalesForItem(itemName);
                await sleep(RATE_LIMIT_MS);
            }

            // Progress update every 50 items
            if ((i + 1) % 50 === 0) {
                winston.info(`Progress: ${i + 1}/${itemNames.length} (${successCount} success, ${failCount} failed)`);
            }
        }

        winston.info('='.repeat(60));
        winston.info('Price Sync Complete!');
        winston.info(`Total: ${itemNames.length} items`);
        winston.info(`Success: ${successCount}`);
        winston.info(`Failed: ${failCount}`);
        winston.info(`Success Rate: ${(successCount / itemNames.length * 100).toFixed(2)}%`);
        winston.info('='.repeat(60));

        process.exit(0);

    } catch (e) {
        winston.error('Fatal error during sync:', e);
        process.exit(1);
    }
}

// Run the sync
main();
