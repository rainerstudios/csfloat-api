/**
 * Manual inventory sync script for testing
 * Syncs Steam inventory items to portfolio_investments table
 */

const steamInventory = require('./lib/steam-inventory');
const Postgres = require('./lib/postgres');
const winston = require('winston');

winston.level = 'info';

const CONFIG = require('./config.js');
const postgres = new Postgres(CONFIG.database_url);

async function syncInventory(steamId) {
    try {
        await postgres.connect();

        console.log(`\n🔄 Syncing inventory for Steam ID: ${steamId}`);

        // Get inventory
        const inventoryResult = await steamInventory.getSteamInventory(steamId);

        if (!inventoryResult.success) {
            console.error('❌ Failed to fetch inventory:', inventoryResult.error);
            process.exit(1);
        }

        console.log(`✅ Found ${inventoryResult.total_items} items in inventory\n`);

        let added = 0;
        let skipped = 0;
        let errors = [];

        // Add each item to portfolio
        for (const item of inventoryResult.items) {
            try {
                // Skip non-weapon items (stickers, cases, etc.) unless you want them
                if (!item.wear_full && item.weapon_type !== 'Knife') {
                    console.log(`⏭️  Skipping: ${item.market_name} (not a weapon)`);
                    skipped++;
                    continue;
                }

                // Get market price
                let price = 0;
                if (item.marketable && item.market_hash_name) {
                    const cachedPrice = await postgres.getCachedPrice(item.market_hash_name);
                    price = cachedPrice?.lowestPrice || 0;
                }

                // Insert into portfolio
                await postgres.pool.query(`
                    INSERT INTO portfolio_investments (
                        user_id, user_steam_id, item_name, purchase_price,
                        quantity, marketplace, is_stattrak, notes
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                `, [
                    'steam_' + steamId,
                    steamId,
                    item.market_name,
                    price,
                    1,
                    'Steam',
                    item.is_stattrak || false,
                    'Imported from Steam inventory'
                ]);

                console.log(`✅ Added: ${item.market_name} (${price > 0 ? '$' + price : 'no price'})`);
                added++;

            } catch (error) {
                console.error(`❌ Error adding ${item.market_name}:`, error.message);
                errors.push({
                    item: item.market_name,
                    error: error.message
                });
            }
        }

        console.log(`\n📊 Sync Summary:`);
        console.log(`   ✅ Added: ${added}`);
        console.log(`   ⏭️  Skipped: ${skipped}`);
        console.log(`   ❌ Errors: ${errors.length}`);

        if (errors.length > 0) {
            console.log('\n❌ Errors:');
            errors.forEach(e => console.log(`   - ${e.item}: ${e.error}`));
        }

        console.log('\n✅ Sync complete!\n');
        process.exit(0);

    } catch (error) {
        console.error('❌ Fatal error:', error);
        process.exit(1);
    }
}

// Get Steam ID from command line or use default
const steamId = process.argv[2] || '76561199094452064';
syncInventory(steamId);
