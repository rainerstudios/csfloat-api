/**
 * CSGO-API Integration Library
 * Fetches and caches item metadata from ByMykel/CSGO-API repository
 * Provides float ranges, doppler phases, rarity data, and more
 */

const fetch = require('node-fetch');
const fs = require('fs').promises;
const path = require('path');

const CACHE_DIR = path.join(__dirname, '../data/csgoapi-cache');
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

const API_BASE = 'https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en';

const ENDPOINTS = {
    skins: `${API_BASE}/skins.json`,
    skinsUngrouped: `${API_BASE}/skins_not_grouped.json`,
    stickers: `${API_BASE}/stickers.json`,
    crates: `${API_BASE}/crates.json`,
    collections: `${API_BASE}/collections.json`,
    agents: `${API_BASE}/agents.json`,
    graffiti: `${API_BASE}/graffiti.json`,
    patches: `${API_BASE}/patches.json`,
    keychains: `${API_BASE}/keychains.json`,
    musicKits: `${API_BASE}/music_kits.json`,
    keys: `${API_BASE}/keys.json`,
    tools: `${API_BASE}/tools.json`,
    collectibles: `${API_BASE}/collectibles.json`
};

// Doppler phase mappings (from CSGO-API utils)
const DOPPLER_PHASES = {
    // Standard Doppler
    '415': 'Ruby',
    '416': 'Sapphire',
    '417': 'Black Pearl',
    '418': 'Phase 1',
    '419': 'Phase 2',
    '420': 'Phase 3',
    '421': 'Phase 4',

    // Gamma Doppler
    '568': 'Emerald',
    '569': 'Phase 1',
    '570': 'Phase 2',
    '571': 'Phase 3',
    '572': 'Phase 4',

    // Glock-18 Gamma Doppler
    '1119': 'Emerald',
    '1120': 'Phase 1',
    '1121': 'Phase 2',
    '1122': 'Phase 3',
    '1123': 'Phase 4'
};

/**
 * Ensure cache directory exists
 */
async function ensureCacheDir() {
    try {
        await fs.access(CACHE_DIR);
    } catch {
        await fs.mkdir(CACHE_DIR, { recursive: true });
    }
}

/**
 * Get cache file path for endpoint
 */
function getCachePath(endpoint) {
    const filename = endpoint.split('/').pop();
    return path.join(CACHE_DIR, filename);
}

/**
 * Check if cache is valid
 */
async function isCacheValid(cachePath) {
    try {
        const stats = await fs.stat(cachePath);
        const age = Date.now() - stats.mtimeMs;
        return age < CACHE_DURATION;
    } catch {
        return false;
    }
}

/**
 * Fetch data from URL with caching
 */
async function fetchWithCache(url, cachePath) {
    await ensureCacheDir();

    // Check cache first
    if (await isCacheValid(cachePath)) {
        const data = await fs.readFile(cachePath, 'utf8');
        return JSON.parse(data);
    }

    // Fetch from API
    console.log(`Fetching ${url}...`);
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    // Save to cache
    await fs.writeFile(cachePath, JSON.stringify(data, null, 2));

    return data;
}

/**
 * Get all skins with metadata
 */
async function getSkins(grouped = true) {
    const endpoint = grouped ? ENDPOINTS.skins : ENDPOINTS.skinsUngrouped;
    const cachePath = getCachePath(endpoint);
    return await fetchWithCache(endpoint, cachePath);
}

/**
 * Get float range for a specific item
 * @param {string} itemName - Item name (e.g., "AK-47 | Redline")
 * @returns {object|null} - {min_float, max_float, wears[]}
 */
async function getFloatRange(itemName) {
    const skins = await getSkins(true);

    // Search through skins array
    for (const skin of skins) {
        if (skin.name === itemName) {
            return {
                item_name: skin.name,
                min_float: skin.min_float,
                max_float: skin.max_float,
                wears: skin.wears || [],
                rarity: skin.rarity,
                category: skin.category,
                weapon: skin.weapon
            };
        }
    }

    return null;
}

/**
 * Get doppler phase information by paint index
 * @param {string|number} paintIndex - Paint index number
 * @returns {object|null} - {phase, paint_index, type}
 */
function getDopplerPhase(paintIndex) {
    const index = String(paintIndex);
    const phase = DOPPLER_PHASES[index];

    if (!phase) {
        return null;
    }

    let type = 'Doppler';
    if (parseInt(index) >= 568 && parseInt(index) <= 572) {
        type = 'Gamma Doppler';
    } else if (parseInt(index) >= 1119 && parseInt(index) <= 1123) {
        type = 'Glock-18 Gamma Doppler';
    }

    return {
        phase,
        paint_index: index,
        type,
        is_rare: ['Ruby', 'Sapphire', 'Black Pearl', 'Emerald'].includes(phase)
    };
}

/**
 * Get complete metadata for an item
 * @param {string} itemName - Item name
 * @returns {object|null} - Complete item metadata
 */
async function getItemMetadata(itemName) {
    const skins = await getSkins(true);

    for (const skin of skins) {
        if (skin.name === itemName) {
            const metadata = {
                id: skin.id,
                name: skin.name,
                description: skin.description,
                weapon: skin.weapon,
                category: skin.category,
                pattern: skin.pattern,
                min_float: skin.min_float,
                max_float: skin.max_float,
                rarity: skin.rarity,
                stattrak: skin.stattrak,
                souvenir: skin.souvenir,
                paint_index: skin.paint_index,
                wears: skin.wears,
                collections: skin.collections,
                crates: skin.crates,
                image: skin.image
            };

            // Add doppler phase if applicable
            if (skin.paint_index && skin.phase) {
                metadata.doppler_info = getDopplerPhase(skin.paint_index);
            }

            return metadata;
        }
    }

    return null;
}

/**
 * Search items by name (fuzzy search)
 * @param {string} query - Search query
 * @param {number} limit - Max results
 * @returns {array} - Array of matching items
 */
async function searchItems(query, limit = 20) {
    const skins = await getSkins(true);
    const lowerQuery = query.toLowerCase();

    const matches = skins.filter(skin =>
        skin.name.toLowerCase().includes(lowerQuery)
    ).slice(0, limit);

    return matches.map(skin => ({
        id: skin.id,
        name: skin.name,
        weapon: skin.weapon?.name,
        category: skin.category?.name,
        rarity: skin.rarity?.name,
        image: skin.image,
        min_float: skin.min_float,
        max_float: skin.max_float
    }));
}

/**
 * Get all items from a specific case
 * @param {string} caseName - Case name
 * @returns {array} - Array of items in the case
 */
async function getCaseContents(caseName) {
    const crates = await fetchWithCache(
        ENDPOINTS.crates,
        getCachePath(ENDPOINTS.crates)
    );

    for (const crate of crates) {
        if (crate.name === caseName) {
            return {
                case_name: crate.name,
                case_id: crate.id,
                type: crate.type,
                first_sale_date: crate.first_sale_date,
                rarity: crate.rarity,
                contains: crate.contains || [],
                contains_rare: crate.contains_rare || [],
                image: crate.image
            };
        }
    }

    return null;
}

/**
 * Get all items from a collection
 * @param {string} collectionName - Collection name
 * @returns {array} - Array of items in the collection
 */
async function getCollectionContents(collectionName) {
    const collections = await fetchWithCache(
        ENDPOINTS.collections,
        getCachePath(ENDPOINTS.collections)
    );

    for (const collection of collections) {
        if (collection.name === collectionName) {
            return {
                collection_name: collection.name,
                collection_id: collection.id,
                contains: collection.contains || [],
                crates: collection.crates || [],
                image: collection.image
            };
        }
    }

    return null;
}

/**
 * Get all stickers
 * @param {number} limit - Max results (default: 100, set to 0 for all)
 * @returns {array} - Array of stickers
 */
async function getStickers(limit = 100) {
    const stickers = await fetchWithCache(
        ENDPOINTS.stickers,
        getCachePath(ENDPOINTS.stickers)
    );

    if (limit === 0) {
        return stickers;
    }

    return stickers.slice(0, limit);
}

/**
 * Clear cache (force refresh)
 */
async function clearCache() {
    try {
        await ensureCacheDir();
        const files = await fs.readdir(CACHE_DIR);
        await Promise.all(files.map(file =>
            fs.unlink(path.join(CACHE_DIR, file))
        ));
        return { success: true, cleared: files.length };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Get cache status
 */
async function getCacheStatus() {
    try {
        await ensureCacheDir();
        const files = await fs.readdir(CACHE_DIR);
        const statuses = await Promise.all(files.map(async file => {
            const filePath = path.join(CACHE_DIR, file);
            const stats = await fs.stat(filePath);
            const age = Date.now() - stats.mtimeMs;
            const sizeKB = (stats.size / 1024).toFixed(2);

            return {
                file,
                size: `${sizeKB} KB`,
                age_hours: (age / (1000 * 60 * 60)).toFixed(1),
                valid: age < CACHE_DURATION
            };
        }));

        return { success: true, cache: statuses };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

module.exports = {
    getSkins,
    getFloatRange,
    getDopplerPhase,
    getItemMetadata,
    searchItems,
    getCaseContents,
    getCollectionContents,
    getStickers,
    clearCache,
    getCacheStatus,
    DOPPLER_PHASES
};
