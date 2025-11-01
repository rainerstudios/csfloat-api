/**
 * Steam Inventory Service
 * Fetches CS2 inventory data from Steam Community API
 */

const fetch = require('node-fetch');

const STEAM_INVENTORY_URL = 'https://steamcommunity.com/inventory';
const CS2_APP_ID = '730';
const CS2_CONTEXT_ID = '2';

/**
 * Fetch Steam user's CS2 inventory
 * @param {string} steamId - Steam ID64 format
 * @returns {Promise<Object>} Inventory data
 */
async function getSteamInventory(steamId) {
    try {
        let allAssets = [];
        let allDescriptions = [];
        let startAssetId = null;
        let hasMoreItems = true;

        // Fetch all pages (Steam uses pagination with ~75 items per page)
        while (hasMoreItems) {
            // Note: Steam rejects count=5000, using default page size
            let url = `${STEAM_INVENTORY_URL}/${steamId}/${CS2_APP_ID}/${CS2_CONTEXT_ID}?l=english`;
            if (startAssetId) {
                url += `&start_assetid=${startAssetId}`;
            }

            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'application/json, text/javascript, */*; q=0.01',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Referer': `https://steamcommunity.com/profiles/${steamId}/inventory`,
                    'X-Requested-With': 'XMLHttpRequest'
                },
                timeout: 30000
            });

            if (!response.ok) {
                const errorText = await response.text().catch(() => '');

                if (response.status === 403) {
                    return {
                        success: false,
                        error: 'Inventory is private',
                        message: 'Please set your Steam inventory to public in privacy settings',
                        debug: { status: response.status, body: errorText.substring(0, 200) }
                    };
                }

                if (response.status === 400 || response.status === 401) {
                    return {
                        success: false,
                        error: 'Cannot access inventory',
                        message: `Steam API returned ${response.status}. Inventory may be private or Steam ID invalid.`,
                        debug: { status: response.status, statusText: response.statusText, body: errorText.substring(0, 200) }
                    };
                }

                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            if (!data.success) {
                return {
                    success: false,
                    error: 'Failed to load inventory',
                    message: data.Error || 'Unknown error from Steam API'
                };
            }

            // Collect assets and descriptions from this page
            if (data.assets) {
                allAssets = allAssets.concat(data.assets);
            }
            if (data.descriptions) {
                allDescriptions = allDescriptions.concat(data.descriptions);
            }

            // Check if there are more items to fetch
            if (data.more_items === 1 && data.last_assetid) {
                startAssetId = data.last_assetid;
                // Add small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 500));
            } else {
                hasMoreItems = false;
            }
        }

        // Combine all data for parsing
        const combinedData = {
            assets: allAssets,
            descriptions: allDescriptions,
            success: true
        };

        // Parse inventory items
        const items = parseInventoryItems(combinedData);

        return {
            success: true,
            total_items: items.length,
            items: items
        };

    } catch (error) {
        console.error('Steam inventory fetch error:', error);
        return {
            success: false,
            error: 'Failed to fetch inventory',
            message: error.message
        };
    }
}

/**
 * Parse raw Steam inventory data into usable format
 */
function parseInventoryItems(data) {
    if (!data.descriptions || !data.assets) {
        return [];
    }

    const items = [];
    const descriptionMap = new Map();

    // Wear abbreviation mapping
    const wearMap = {
        'Factory New': 'FN',
        'Minimal Wear': 'MW',
        'Field-Tested': 'FT',
        'Well-Worn': 'WW',
        'Battle-Scarred': 'BS'
    };

    // Create a map of descriptions for fast lookup
    for (const desc of data.descriptions) {
        const key = `${desc.classid}_${desc.instanceid}`;
        descriptionMap.set(key, desc);
    }

    // Process assets with their descriptions
    for (const asset of data.assets) {
        const key = `${asset.classid}_${asset.instanceid}`;
        const description = descriptionMap.get(key);

        if (!description) continue;

        // Extract wear from market name
        const wearMatch = description.market_name?.match(/\((Factory New|Minimal Wear|Field-Tested|Well-Worn|Battle-Scarred)\)/);
        const wearFull = wearMatch ? wearMatch[1] : null;
        const wear = wearFull ? wearMap[wearFull] : null;

        // Extract item details matching frontend specification
        const item = {
            // Core identification
            assetid: asset.assetid,
            classid: asset.classid,
            instanceid: asset.instanceid,

            // Display names
            name: description.name,
            market_name: description.market_name,
            market_hash_name: description.market_hash_name,

            // Item properties
            type: description.type,
            icon_url: description.icon_url, // Just the path, frontend can add CDN prefix
            icon_url_large: description.icon_url_large,
            name_color: description.name_color,

            // Trading properties
            tradable: description.tradable === 1,
            marketable: description.marketable === 1,
            commodity: description.commodity === 1,

            // Item attributes
            is_stattrak: description.market_name?.includes('StatTrak™') || false,
            is_souvenir: description.market_name?.includes('Souvenir') || false,
            wear: wear,
            wear_full: wearFull,

            // Tags and metadata
            rarity: extractTag(description.tags, 'Rarity'),
            rarity_color: extractTagColor(description.tags, 'Rarity'),
            exterior: extractTag(description.tags, 'Exterior'),
            weapon_type: extractTag(description.tags, 'Type'),
            category: extractTag(description.tags, 'Category'),
            quality: extractTag(description.tags, 'Quality'),

            // Full CDN URLs (for convenience)
            image_url: `https://community.cloudflare.steamstatic.com/economy/image/${description.icon_url}`,
            image_large: description.icon_url_large ? `https://community.cloudflare.steamstatic.com/economy/image/${description.icon_url_large}` : null,

            // Float value placeholders (will be null unless fetched)
            float_value: null,
            pattern_index: null,
            defindex: null,
            paintindex: null,

            // Item descriptions
            descriptions: description.descriptions || []
        };

        // Extract inspect link if available
        const inspectLink = extractInspectLink(description.actions);
        if (inspectLink) {
            item.inspect_link = inspectLink;
            const params = parseInspectLink(inspectLink);
            item.inspect_params = params;

            // Extract defindex from inspect link if available
            if (params.d) {
                item.defindex = parseInt(params.d);
            }
        }

        items.push(item);
    }

    return items;
}

/**
 * Extract tag value by category
 */
function extractTag(tags, category) {
    if (!tags) return null;
    const tag = tags.find(t => t.category === category);
    return tag ? tag.localized_tag_name || tag.name : null;
}

/**
 * Extract tag color by category
 */
function extractTagColor(tags, category) {
    if (!tags) return null;
    const tag = tags.find(t => t.category === category);
    return tag ? tag.color : null;
}

/**
 * Extract inspect link from actions
 */
function extractInspectLink(actions) {
    if (!actions) return null;
    const inspectAction = actions.find(a => a.name === 'Inspect in Game...' || a.link);
    return inspectAction ? inspectAction.link : null;
}

/**
 * Parse inspect link to extract parameters
 */
function parseInspectLink(link) {
    const params = {};
    const match = link.match(/[SM](\d+)A(\d+)D(\d+)$/);
    if (match) {
        params.s = match[1];
        params.a = match[2];
        params.d = match[3];
    }
    return params;
}

/**
 * Get inventory value estimate
 * Fetches market prices and calculates total
 */
async function getInventoryValue(steamId, postgres) {
    try {
        const inventoryResult = await getSteamInventory(steamId);

        if (!inventoryResult.success) {
            return inventoryResult;
        }

        let totalValue = 0;
        let valuedItems = 0;
        const itemValues = [];

        // Get market prices for marketable items
        for (const item of inventoryResult.items) {
            if (item.marketable && item.market_hash_name) {
                // Try to get cached price
                const cachedPrice = await postgres.getCachedPrice(item.market_hash_name);

                if (cachedPrice && cachedPrice.price) {
                    const price = parseFloat(cachedPrice.price);
                    totalValue += price;
                    valuedItems++;

                    itemValues.push({
                        assetid: item.assetid,
                        name: item.market_name || item.name,
                        market_hash_name: item.market_hash_name,
                        price: price,
                        image: item.image_url,
                        wear: item.wear,
                        is_stattrak: item.is_stattrak
                    });
                }
            }
        }

        return {
            success: true,
            total_items: inventoryResult.total_items,
            valued_items: valuedItems,
            total_value: totalValue,
            average_item_value: valuedItems > 0 ? totalValue / valuedItems : 0,
            top_items: itemValues.sort((a, b) => b.price - a.price).slice(0, 10)
        };

    } catch (error) {
        console.error('Inventory value calculation error:', error);
        return {
            success: false,
            error: 'Failed to calculate inventory value',
            message: error.message
        };
    }
}

module.exports = {
    getSteamInventory,
    getInventoryValue
};
