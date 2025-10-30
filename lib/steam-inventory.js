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
        const url = `${STEAM_INVENTORY_URL}/${steamId}/${CS2_APP_ID}/${CS2_CONTEXT_ID}?l=english&count=5000`;

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'CS2FloatChecker/1.0'
            },
            timeout: 30000
        });

        if (!response.ok) {
            if (response.status === 403) {
                return {
                    success: false,
                    error: 'Inventory is private',
                    message: 'Please set your Steam inventory to public in privacy settings'
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

        // Parse inventory items
        const items = parseInventoryItems(data);

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

        // Extract item details
        const item = {
            asset_id: asset.assetid,
            name: description.market_name || description.name,
            name_color: description.name_color,
            type: description.type,
            rarity: extractTag(description.tags, 'Rarity'),
            rarity_color: extractTagColor(description.tags, 'Rarity'),
            exterior: extractTag(description.tags, 'Exterior'),
            weapon_type: extractTag(description.tags, 'Type'),
            category: extractTag(description.tags, 'Category'),
            quality: extractTag(description.tags, 'Quality'),
            image_url: `https://community.cloudflare.steamstatic.com/economy/image/${description.icon_url}`,
            image_large: description.icon_url_large ? `https://community.cloudflare.steamstatic.com/economy/image/${description.icon_url_large}` : null,
            marketable: description.marketable === 1,
            tradable: description.tradable === 1,
            commodity: description.commodity === 1,
            market_hash_name: description.market_hash_name,
            descriptions: description.descriptions || []
        };

        // Check if StatTrak
        item.is_stattrak = item.name.includes('StatTrak™');
        item.is_souvenir = item.name.includes('Souvenir');

        // Extract float value from inspect link if available
        const inspectLink = extractInspectLink(description.actions);
        if (inspectLink) {
            item.inspect_link = inspectLink;
            item.inspect_params = parseInspectLink(inspectLink);
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
                        name: item.name,
                        market_hash_name: item.market_hash_name,
                        price: price,
                        image: item.image_url
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
