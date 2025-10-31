const fetch = require('node-fetch');
const steamInventory = require('./lib/steam-inventory');

// Test Steam Community API directly
async function testSteamAPI() {
    console.log('=== Testing Steam Community API ===\n');

    const testCases = [
        { id: '76561198084398045', name: 'shroud (public profile)' },
        { id: '76561197960287930', name: 'Gabe Newell' },
        { id: '76561199094452064', name: 'Test user' }
    ];

    for (const test of testCases) {
        const url = `https://steamcommunity.com/inventory/${test.id}/730/2?l=english&count=5`;

        console.log(`\n📦 Testing: ${test.name}`);
        console.log(`SteamID: ${test.id}`);

        try {
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'application/json, text/javascript, */*; q=0.01',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Referer': `https://steamcommunity.com/profiles/${test.id}/inventory`,
                    'X-Requested-With': 'XMLHttpRequest'
                },
                timeout: 10000
            });

            console.log(`Status: ${response.status} ${response.statusText}`);

            if (!response.ok) {
                if (response.status === 403) {
                    console.log('❌ Inventory is private');
                } else {
                    console.log(`❌ HTTP Error: ${response.status}`);
                }
                continue;
            }

            const text = await response.text();
            let data;

            try {
                data = JSON.parse(text);
            } catch (e) {
                console.log('❌ Invalid JSON response');
                console.log('Response preview:', text.substring(0, 100));
                continue;
            }

            if (!data) {
                console.log('❌ Empty response');
                continue;
            }

            if (data.error) {
                console.log(`❌ Steam API Error: ${data.error}`);
                continue;
            }

            console.log('✅ Success!');
            console.log(`Total inventory items: ${data.total_inventory_count || 'N/A'}`);
            console.log(`Assets returned: ${data.assets ? data.assets.length : 0}`);
            console.log(`Descriptions: ${data.descriptions ? data.descriptions.length : 0}`);

            if (data.assets && data.assets.length > 0) {
                const asset = data.assets[0];
                const desc = data.descriptions.find(d =>
                    d.classid === asset.classid && d.instanceid === asset.instanceid
                );

                if (desc) {
                    console.log('\nSample item:');
                    console.log(`  Name: ${desc.market_name || desc.name}`);
                    console.log(`  Type: ${desc.type}`);
                    console.log(`  Tradable: ${desc.tradable === 1}`);
                    console.log(`  Marketable: ${desc.marketable === 1}`);
                }
            }

        } catch (error) {
            console.log(`❌ Error: ${error.message}`);
        }

        // Wait between requests
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
}

// Test our inventory parsing function
async function testInventoryParser() {
    console.log('\n\n=== Testing Our Inventory Parser ===\n');

    const steamId = '76561198084398045'; // shroud - known public inventory

    console.log(`Fetching inventory for SteamID: ${steamId}`);

    try {
        const result = await steamInventory.getSteamInventory(steamId);

        console.log('\nParser Result:');
        console.log(`Success: ${result.success}`);

        if (!result.success) {
            console.log(`Error: ${result.error}`);
            console.log(`Message: ${result.message}`);
            return;
        }

        console.log(`Total items: ${result.total_items}`);

        if (result.items && result.items.length > 0) {
            const item = result.items[0];

            console.log('\nFirst item parsed:');
            console.log(JSON.stringify({
                assetid: item.assetid,
                name: item.name,
                market_name: item.market_name,
                type: item.type,
                wear: item.wear,
                wear_full: item.wear_full,
                is_stattrak: item.is_stattrak,
                tradable: item.tradable,
                marketable: item.marketable,
                rarity: item.rarity,
                weapon_type: item.weapon_type,
                image_url: item.image_url?.substring(0, 60) + '...',
                inspect_link: item.inspect_link ? 'Present' : 'None',
                defindex: item.defindex
            }, null, 2));
        }

    } catch (error) {
        console.log(`❌ Parser Error: ${error.message}`);
        console.error(error);
    }
}

// Run tests
(async () => {
    await testSteamAPI();
    await testInventoryParser();
    console.log('\n=== Tests Complete ===\n');
})();
