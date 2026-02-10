require('dotenv').config(); // Load environment variables from .env file

global._mckay_statistics_opt_out = true; // Opt out of node-steam-user stats

const optionDefinitions = [
    { name: 'config', alias: 'c', type: String, defaultValue: './config.js' }, // Config file location
    { name: 'steam_data', alias: 's', type: String } // Steam data directory
];

const winston = require('winston'),
    args = require('command-line-args')(optionDefinitions),
    bodyParser = require('body-parser'),
    rateLimit = require('express-rate-limit'),
    utils = require('./lib/utils'),
    queue = new (require('./lib/queue'))(),
    InspectURL = require('./lib/inspect_url'),
    botController = new (require('./lib/bot_controller'))(),
    CONFIG = require(args.config),
    postgres = new (require('./lib/postgres'))(CONFIG.database_url, CONFIG.enable_bulk_inserts),
    gameData = new (require('./lib/game_data'))(CONFIG.game_files_update_interval, CONFIG.enable_game_file_updates),
    errors = require('./errors'),
    Job = require('./lib/job');

if (CONFIG.max_simultaneous_requests === undefined) {
    CONFIG.max_simultaneous_requests = 1;
}

winston.level = CONFIG.logLevel || 'debug';

if (CONFIG.logins.length === 0) {
    console.log('There are no bot logins. Please add some in config.json');
    process.exit(1);
}

if (args.steam_data) {
    CONFIG.bot_settings.steam_user.dataDirectory = args.steam_data;
}

for (let [i, loginData] of CONFIG.logins.entries()) {
    const settings = Object.assign({}, CONFIG.bot_settings);
    if (CONFIG.proxies && CONFIG.proxies.length > 0) {
        const proxy = CONFIG.proxies[i % CONFIG.proxies.length];

        if (proxy.startsWith('http://')) {
            settings.steam_user = Object.assign({}, settings.steam_user, {httpProxy: proxy});
        } else if (proxy.startsWith('socks5://')) {
            settings.steam_user = Object.assign({}, settings.steam_user, {socksProxy: proxy});
        } else {
            console.log(`Invalid proxy '${proxy}' in config, must prefix with http:// or socks5://`);
            process.exit(1);
        }
    }

    botController.addBot(loginData, settings);
}

postgres.connect();

// Setup and configure express
const app = require('express')();
app.use(function (req, res, next) {
    if (req.method === 'POST') {
        // Default content-type
        req.headers['content-type'] = 'application/json';
    }
    next();
});
app.use(bodyParser.json({limit: '5mb'}));

// Import new middleware
const {
    asyncHandler,
    ApiError,
    errorHandler,
    notFoundHandler,
    requestLogger
} = require('./middleware/errorHandler');
const {
    helmetConfig,
    generalLimiter,
    sanitizeInput
} = require('./middleware/security');
const {
    portfolioSchemas,
    floatSchemas,
    priceSchemas,
    commonSchemas,
    validate,
    validateQuery,
    validateParams
} = require('./middleware/validation');
const { z } = require('zod');

// Security middleware
app.use(helmetConfig); // Security headers
app.use(requestLogger); // Request logging
app.use(sanitizeInput); // Input sanitization

app.use(function (error, req, res, next) {
    // Handle bodyParser errors
    if (error instanceof SyntaxError) {
        errors.BadBody.respond(res);
    }
    else next();
});

// =====================================================================
// STEAM INVENTORY (for float inspection only - no auth needed)
// =====================================================================
// Note: Portfolio-related inventory sync moved to Investment API (port 3003)
const steamInventory = require('./lib/steam-inventory');



if (CONFIG.trust_proxy === true) {
    app.enable('trust proxy');
}

CONFIG.allowed_regex_origins = CONFIG.allowed_regex_origins || [];
CONFIG.allowed_origins = CONFIG.allowed_origins || [];
const allowedRegexOrigins = CONFIG.allowed_regex_origins.map((origin) => new RegExp(origin));


async function handleJob(job) {
    // See which items have already been cached
    const itemData = await postgres.getItemData(job.getRemainingLinks().map(e => e.link));
    for (let item of itemData) {
        const link = job.getLink(item.a);

        if (!item.price && link.price) {
            postgres.updateItemPrice(item.a, link.price);
        }

        gameData.addAdditionalItemProperties(item);
        item = utils.removeNullValues(item);

        job.setResponse(item.a, item);
    }

    if (!botController.hasBotOnline()) {
        return job.setResponseRemaining(errors.SteamOffline);
    }

    if (CONFIG.max_simultaneous_requests > 0 &&
        (queue.getUserQueuedAmt(job.ip) + job.remainingSize()) > CONFIG.max_simultaneous_requests) {
        return job.setResponseRemaining(errors.MaxRequests);
    }

    if (CONFIG.max_queue_size > 0 && (queue.size() + job.remainingSize()) > CONFIG.max_queue_size) {
        return job.setResponseRemaining(errors.MaxQueueSize);
    }

    if (job.remainingSize() > 0) {
        queue.addJob(job, CONFIG.bot_settings.max_attempts);
    }
}

function canSubmitPrice(key, link, price) {
    return CONFIG.price_key && key === CONFIG.price_key && price && link.isMarketLink() && utils.isOnlyDigits(price);
}

app.use(function (req, res, next) {
    if (CONFIG.allowed_origins.length > 0 && req.get('origin') != undefined) {
        // check to see if its a valid domain
        const allowed = CONFIG.allowed_origins.indexOf(req.get('origin')) > -1 ||
            allowedRegexOrigins.findIndex((reg) => reg.test(req.get('origin'))) > -1;

        if (allowed) {
            res.header('Access-Control-Allow-Origin', req.get('origin'));
            res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
            res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
            res.header('Access-Control-Allow-Credentials', 'true');
        }
    }

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    next()
});

if (CONFIG.rate_limit && CONFIG.rate_limit.enable) {
    app.use(rateLimit({
        windowMs: CONFIG.rate_limit.window_ms,
        max: CONFIG.rate_limit.max,
        headers: false,
        handler: function (req, res) {
            errors.RateLimit.respond(res);
        }
    }))
}

app.get('/', function(req, res) {
    // Get and parse parameters
    let link;

    if ('url' in req.query) {
        link = new InspectURL(req.query.url);
    }
    else if ('a' in req.query && 'd' in req.query && ('s' in req.query || 'm' in req.query)) {
        link = new InspectURL(req.query);
    }

    if (!link || !link.getParams()) {
        return errors.InvalidInspect.respond(res);
    }

    const job = new Job(req, res, /* bulk */ false);

    let price;

    if (canSubmitPrice(req.query.priceKey, link, req.query.price)) {
        price = parseInt(req.query.price);
    }

    job.add(link, price);

    try {
        handleJob(job);
    } catch (e) {
        winston.warn(e);
        errors.GenericBad.respond(res);
    }
});

app.post('/bulk', (req, res) => {
    if (!req.body || (CONFIG.bulk_key && req.body.bulk_key != CONFIG.bulk_key)) {
        return errors.BadSecret.respond(res);
    }

    if (!req.body.links || req.body.links.length === 0) {
        return errors.BadBody.respond(res);
    }

    if (CONFIG.max_simultaneous_requests > 0 && req.body.links.length > CONFIG.max_simultaneous_requests) {
        return errors.MaxRequests.respond(res);
    }

    const job = new Job(req, res, /* bulk */ true);

    for (const data of req.body.links) {
        const link = new InspectURL(data.link);
        if (!link.valid) {
            return errors.InvalidInspect.respond(res);
        }

        let price;

        if (canSubmitPrice(req.body.priceKey, link, data.price)) {
            price = parseInt(req.query.price);
        }

        job.add(link, price);
    }

    try {
        handleJob(job);
    } catch (e) {
        winston.warn(e);
        errors.GenericBad.respond(res);
    }
});

app.get('/api/stats', (req, res) => {
    res.json({
        bots_online: botController.getReadyAmount(),
        bots_total: botController.bots.length,
        queue_size: queue.queue.length,
        queue_concurrency: queue.concurrency,
    });
});

// BATCH PROCESSING ENDPOINTS

// Batch Price Comparison - Check prices for multiple items at once
app.post('/api/batch/prices', async (req, res) => {
    try {
        const { items } = req.body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                error: 'Missing or invalid items array',
                example: { items: ['AK-47 | Redline (Field-Tested)', 'AWP | Asiimov (Field-Tested)'] }
            });
        }

        if (items.length > 50) {
            return res.status(400).json({
                error: 'Maximum 50 items per batch request'
            });
        }

        const results = [];
        const errors = [];

        // Process items in parallel (with cache)
        const promises = items.map(async (itemName, index) => {
            try {
                // Check cache first
                const cached = await postgres.getCachedPrice(itemName);
                if (cached) {
                    return { index, itemName, data: cached, cached: true };
                }

                // Fetch from API if not cached
                const apiKey = CONFIG.skinbroker_api_key || 'sbv1UvaYyGLofmw26Huqqadjkqi3TwvwTzPn6mDaRQD3Fta6hUOc';
                const url = `https://skin.broker/api/v1/item?marketHashName=${encodeURIComponent(itemName)}&key=${apiKey}`;

                const response = await fetch(url);
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                const data = await response.json();
                if (!data.success) {
                    throw new Error('Item not found');
                }

                // Transform and cache
                const priceData = transformPriceData(data, itemName);
                await postgres.cachePriceData(itemName, priceData);

                return { index, itemName, data: priceData, cached: false };
            } catch (error) {
                return { index, itemName, error: error.message };
            }
        });

        const allResults = await Promise.all(promises);

        // Separate successful results from errors
        allResults.forEach(result => {
            if (result.error) {
                errors.push({
                    index: result.index,
                    itemName: result.itemName,
                    error: result.error
                });
            } else {
                results.push({
                    index: result.index,
                    itemName: result.itemName,
                    prices: result.data.prices,
                    lowestPrice: result.data.lowestPrice,
                    highestPrice: result.data.highestPrice,
                    cached: result.cached
                });
            }
        });

        res.json({
            success: true,
            total: items.length,
            successful: results.length,
            failed: errors.length,
            results: results,
            errors: errors.length > 0 ? errors : undefined
        });

    } catch (e) {
        winston.error('Error in batch price processing:', e);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Helper function to transform price data (extracted for reuse)
function transformPriceData(data, marketHashName) {
    function generateMarketplaceUrl(market, itemName) {
        const encodedName = encodeURIComponent(itemName);
        switch(market) {
            case 'buff163':
                return `https://buff.163.com/market/csgo#tab=selling&page_num=1&search=${encodedName}`;
            case 'skinport':
                return `https://skinport.com/market?search=${encodedName}`;
            case 'marketCsgo':
                return `https://cs.money/csgo/trade/?search=${encodedName}`;
            case 'csfloat':
                return `https://csfloat.com/search?search=${encodedName}`;
            case 'steam':
                return `https://steamcommunity.com/market/listings/730/${encodedName}`;
            default:
                return null;
        }
    }

    return {
        success: true,
        name: data.name,
        prices: {
            buff163: data.price.buff ? {
                price_usd: data.price.buff.converted.price,
                price_cny: data.price.buff.original.price,
                listings: data.price.buff.count,
                updated: new Date(data.price.buff.updated * 1000).toISOString(),
                url: generateMarketplaceUrl('buff163', marketHashName)
            } : null,
            skinport: data.price.skinport ? {
                price_usd: data.price.skinport.converted.price,
                price_eur: data.price.skinport.original.price,
                listings: data.price.skinport.count,
                updated: new Date(data.price.skinport.updated * 1000).toISOString(),
                url: generateMarketplaceUrl('skinport', marketHashName)
            } : null,
            marketCsgo: data.price.marketCsgo ? {
                price_usd: data.price.marketCsgo.original.price,
                listings: data.price.marketCsgo.count,
                updated: new Date(data.price.marketCsgo.updated * 1000).toISOString(),
                url: generateMarketplaceUrl('marketCsgo', marketHashName)
            } : null,
            csfloat: data.price.csfloat ? {
                price_usd: data.price.csfloat.converted.price,
                listings: data.price.csfloat.count,
                updated: new Date(data.price.csfloat.updated * 1000).toISOString(),
                url: generateMarketplaceUrl('csfloat', marketHashName)
            } : null,
            steam: data.price.steam ? {
                price_usd: data.price.steam.converted.price,
                volume: data.price.steam.count,
                updated: new Date(data.price.steam.updated * 1000).toISOString(),
                url: generateMarketplaceUrl('steam', marketHashName)
            } : null
        },
        lowestPrice: Math.min(
            ...Object.values(data.price)
                .filter(p => p && p.converted)
                .map(p => p.converted.price)
        ),
        highestPrice: Math.max(
            ...Object.values(data.price)
                .filter(p => p && p.converted)
                .map(p => p.converted.price)
        )
    };
}

// Batch Float Rarity - Check rarity for multiple floats at once
app.post('/api/batch/rarity', async (req, res) => {
    try {
        const { items } = req.body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                error: 'Missing or invalid items array',
                example: {
                    items: [
                        { defindex: 7, paintindex: 279, floatvalue: 0.15 },
                        { defindex: 9, paintindex: 344, floatvalue: 0.25 }
                    ]
                }
            });
        }

        if (items.length > 100) {
            return res.status(400).json({
                error: 'Maximum 100 items per batch request'
            });
        }

        const results = [];
        const errors = [];

        // Process all items in parallel (database queries are fast)
        const promises = items.map(async (item, index) => {
            try {
                const { defindex, paintindex, floatvalue } = item;

                if (!defindex || !paintindex || floatvalue === undefined) {
                    throw new Error('Missing required fields: defindex, paintindex, floatvalue');
                }

                const rarityData = await postgres.getFloatRarity(
                    parseInt(defindex),
                    parseInt(paintindex),
                    parseFloat(floatvalue)
                );

                return { index, item, data: rarityData };
            } catch (error) {
                return { index, item, error: error.message };
            }
        });

        const allResults = await Promise.all(promises);

        // Separate successful results from errors
        allResults.forEach(result => {
            if (result.error) {
                errors.push({
                    index: result.index,
                    item: result.item,
                    error: result.error
                });
            } else {
                results.push({
                    index: result.index,
                    item: result.item,
                    rarity: result.data
                });
            }
        });

        res.json({
            success: true,
            total: items.length,
            successful: results.length,
            failed: errors.length,
            results: results,
            errors: errors.length > 0 ? errors : undefined
        });

    } catch (e) {
        winston.error('Error in batch rarity processing:', e);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Batch Float Premium - Calculate premium for multiple items at once
app.post('/api/batch/float-premium', async (req, res) => {
    try {
        const { items } = req.body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                error: 'Missing or invalid items array',
                example: {
                    items: [
                        { marketHashName: 'AK-47 | Redline (Field-Tested)', floatValue: 0.18 },
                        { marketHashName: 'AWP | Asiimov (Field-Tested)', floatValue: 0.25 }
                    ]
                }
            });
        }

        if (items.length > 50) {
            return res.status(400).json({
                error: 'Maximum 50 items per batch request'
            });
        }

        const results = [];
        const errors = [];

        const promises = items.map(async (item, index) => {
            try {
                const { marketHashName, floatValue } = item;

                if (!marketHashName || floatValue === undefined) {
                    throw new Error('Missing required fields: marketHashName, floatValue');
                }

                const premium = await postgres.calculateFloatPricePremium(
                    marketHashName,
                    parseFloat(floatValue)
                );

                return { index, item, data: premium };
            } catch (error) {
                return { index, item, error: error.message };
            }
        });

        const allResults = await Promise.all(promises);

        allResults.forEach(result => {
            if (result.error) {
                errors.push({
                    index: result.index,
                    item: result.item,
                    error: result.error
                });
            } else {
                results.push({
                    index: result.index,
                    item: result.item,
                    premium: result.data
                });
            }
        });

        res.json({
            success: true,
            total: items.length,
            successful: results.length,
            failed: errors.length,
            results: results,
            errors: errors.length > 0 ? errors : undefined
        });

    } catch (e) {
        winston.error('Error in batch float premium processing:', e);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Trade Protection Tracker - Ownership History Endpoint
app.get('/api/ownership-history/:floatId', async (req, res) => {
    try {
        const floatId = req.params.floatId;

        if (!floatId || isNaN(floatId)) {
            return res.status(400).json({ error: 'Invalid float ID' });
        }

        const history = await postgres.getOwnershipHistory(floatId);
        const tradeRisk = calculateTradeRisk(history);

        res.json({
            floatId: floatId,
            ownershipHistory: history,
            tradeRisk: tradeRisk,
            totalOwners: history.length
        });
    } catch (e) {
        winston.error('Error fetching ownership history:', e);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Float Rarity Score Endpoint
app.get('/api/float-rarity/:defindex/:paintindex/:floatvalue', async (req, res) => {
    try {
        const { defindex, paintindex, floatvalue } = req.params;

        if (!defindex || !paintindex || !floatvalue) {
            return res.status(400).json({ error: 'Missing required parameters' });
        }

        const rarityData = await postgres.getFloatRarity(
            parseInt(defindex),
            parseInt(paintindex),
            parseFloat(floatvalue)
        );

        res.json(rarityData);
    } catch (e) {
        winston.error('Error calculating float rarity:', e);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Pattern Statistics for Trade-Up Calculator
app.get('/api/pattern-stats/:defindex/:paintindex', async (req, res) => {
    try {
        const { defindex, paintindex } = req.params;

        if (!defindex || !paintindex) {
            return res.status(400).json({ error: 'Missing required parameters' });
        }

        const stats = await postgres.getPatternStats(
            parseInt(defindex),
            parseInt(paintindex)
        );

        res.json(stats);
    } catch (e) {
        winston.error('Error fetching pattern stats:', e);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Skin.Broker Price API - Get prices from Buff163, Skinport, and other markets
// WITH CACHING for 300 concurrent users
app.get('/api/price/:marketHashName', async (req, res) => {
    try {
        const marketHashName = decodeURIComponent(req.params.marketHashName);

        if (!marketHashName) {
            return res.status(400).json({ error: 'Missing market hash name' });
        }

        // Check cache first (5 minute TTL)
        const cachedData = await postgres.getCachedPrice(marketHashName);
        if (cachedData) {
            winston.debug(`Price cache HIT for ${marketHashName}`);
            return res.json(cachedData);
        }

        winston.debug(`Price cache MISS for ${marketHashName}, fetching from API`);

        // Use Skin.Broker authenticated API for detailed pricing
        const apiKey = CONFIG.skinbroker_api_key || 'sbv1UvaYyGLofmw26Huqqadjkqi3TwvwTzPn6mDaRQD3Fta6hUOc';
        const url = `https://skin.broker/api/v1/item?marketHashName=${encodeURIComponent(marketHashName)}&key=${apiKey}`;

        const response = await fetch(url);

        if (!response.ok) {
            winston.warn(`Skin.Broker API returned status ${response.status}`);

            // Handle rate limiting - try to return stale cache if available
            if (response.status === 429) {
                const staleCache = await postgres.getCachedPrice(marketHashName, true); // Get even expired cache
                if (staleCache) {
                    winston.info(`Returning stale cache for ${marketHashName} due to rate limit`);
                    staleCache.cached = true;
                    staleCache.stale = true;
                    return res.status(200).json(staleCache);
                }

                return res.status(429).json({
                    success: false,
                    error: 'Rate limit exceeded, please try again later'
                });
            }

            return res.status(response.status).json({
                success: false,
                error: 'Unable to fetch pricing data'
            });
        }

        let data;
        try {
            data = await response.json();
        } catch (jsonError) {
            winston.error('Error parsing pricing JSON:', jsonError);
            return res.status(500).json({
                success: false,
                error: 'Invalid JSON response from pricing API'
            });
        }

        if (!data.success) {
            return res.json({
                success: false,
                error: 'Item not found'
            });
        }

        // Helper function to generate marketplace URLs
        function generateMarketplaceUrl(market, itemName) {
            const encodedName = encodeURIComponent(itemName);

            switch(market) {
                case 'buff163':
                    // Buff163 search URL
                    return `https://buff.163.com/market/csgo#tab=selling&page_num=1&search=${encodedName}`;

                case 'skinport':
                    // Skinport uses slugified names (convert to lowercase, replace spaces/special chars)
                    const slug = itemName
                        .toLowerCase()
                        .replace(/[™|]/g, '')
                        .replace(/\s+/g, '-')
                        .replace(/[()]/g, '');
                    return `https://skinport.com/market?search=${encodedName}`;

                case 'marketCsgo':
                    // CS.MONEY search
                    return `https://cs.money/csgo/trade/?search=${encodedName}`;

                case 'csfloat':
                    // CSFloat market search
                    return `https://csfloat.com/search?search=${encodedName}`;

                case 'steam':
                    // Steam Community Market
                    return `https://steamcommunity.com/market/listings/730/${encodedName}`;

                case 'skinbaron':
                    return `https://skinbaron.de/offers?appId=730&search=${encodedName}`;

                case 'gamerpay':
                    return `https://gamerpay.gg/en/csgo/?search=${encodedName}`;

                case 'waxpeer':
                    return `https://waxpeer.com/csgo?search=${encodedName}`;

                case 'dmarket':
                    return `https://dmarket.com/ingame-items/item-list/csgo-skins?title=${encodedName}`;

                case 'shadowpay':
                    return `https://shadowpay.com/en/csgo?search=${encodedName}`;

                default:
                    return null;
            }
        }

        // Transform to simplified format with marketplace URLs
        const priceData = {
            success: true,
            name: data.name,
            prices: {
                buff163: data.price.buff ? {
                    price_usd: data.price.buff.converted.price,
                    price_cny: data.price.buff.original.price,
                    listings: data.price.buff.count,
                    updated: new Date(data.price.buff.updated * 1000).toISOString(),
                    url: generateMarketplaceUrl('buff163', marketHashName)
                } : null,
                skinport: data.price.skinport ? {
                    price_usd: data.price.skinport.converted.price,
                    price_eur: data.price.skinport.original.price,
                    listings: data.price.skinport.count,
                    updated: new Date(data.price.skinport.updated * 1000).toISOString(),
                    url: generateMarketplaceUrl('skinport', marketHashName)
                } : null,
                marketCsgo: data.price.marketCsgo ? {
                    price_usd: data.price.marketCsgo.original.price,
                    listings: data.price.marketCsgo.count,
                    updated: new Date(data.price.marketCsgo.updated * 1000).toISOString(),
                    url: generateMarketplaceUrl('marketCsgo', marketHashName)
                } : null,
                csfloat: data.price.csfloat ? {
                    price_usd: data.price.csfloat.converted.price,
                    listings: data.price.csfloat.count,
                    updated: new Date(data.price.csfloat.updated * 1000).toISOString(),
                    url: generateMarketplaceUrl('csfloat', marketHashName)
                } : null,
                steam: data.price.steam ? {
                    price_usd: data.price.steam.converted.price,
                    volume: data.price.steam.count,
                    updated: new Date(data.price.steam.updated * 1000).toISOString(),
                    url: generateMarketplaceUrl('steam', marketHashName)
                } : null
            },
            // Calculate average price and recommendations
            lowestPrice: Math.min(
                ...Object.values(data.price)
                    .filter(p => p && p.converted)
                    .map(p => p.converted.price)
            ),
            highestPrice: Math.max(
                ...Object.values(data.price)
                    .filter(p => p && p.converted)
                    .map(p => p.converted.price)
            ),
            cached: false
        };

        // Cache the result for 5 minutes
        await postgres.cachePriceData(marketHashName, priceData);

        res.json(priceData);

    } catch (e) {
        winston.error('Error fetching Skin.Broker pricing:', e);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Skin.Broker HTML Widget - Quick comparison (FREE endpoint, no auth needed)
app.get('/api/price-widget', async (req, res) => {
    try {
        const { marketName, currency, price } = req.query;

        if (!marketName) {
            return res.status(400).json({ error: 'Missing marketName parameter' });
        }

        // Use free extension endpoint
        const url = new URL('https://skin.broker/api/ext');
        url.searchParams.append('marketName', marketName);
        url.searchParams.append('currency', currency || 'USD');
        url.searchParams.append('price', price || '0');

        const response = await fetch(url.toString());

        if (!response.ok) {
            return res.status(response.status).json({
                success: false,
                error: 'Unable to fetch price widget'
            });
        }

        const data = await response.json();

        res.json({
            success: true,
            html: data.html,
            marketName: marketName
        });

    } catch (e) {
        winston.error('Error fetching Skin.Broker widget:', e);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Skin.Broker - Price History Chart (7/14/30 days)
app.get('/api/price-history/:marketHashName', async (req, res) => {
    try {
        const marketHashName = decodeURIComponent(req.params.marketHashName);
        const timeframe = req.query.timeframe || '30'; // 7, 14, or 30 days

        if (!['7', '14', '30'].includes(timeframe)) {
            return res.status(400).json({ error: 'Invalid timeframe. Use 7, 14, or 30' });
        }

        const apiKey = CONFIG.skinbroker_api_key || 'sbv1UvaYyGLofmw26Huqqadjkqi3TwvwTzPn6mDaRQD3Fta6hUOc';
        const url = `https://skin.broker/api/v2/item/chart?marketHashName=${encodeURIComponent(marketHashName)}&timeframe=${timeframe}&key=${apiKey}`;

        const response = await fetch(url);

        if (!response.ok) {
            return res.status(response.status).json({
                success: false,
                error: 'Unable to fetch price history'
            });
        }

        let data;
        try {
            data = await response.json();
        } catch (jsonError) {
            winston.error('Error parsing price history JSON:', jsonError);
            return res.status(500).json({
                success: false,
                error: 'Invalid JSON response from price history API'
            });
        }

        if (!data.success) {
            return res.json({
                success: false,
                error: 'No price history available'
            });
        }

        // Transform chart data for easier frontend use
        const chartData = {
            success: true,
            name: marketHashName,
            timeframe: `${timeframe} days`,
            markets: data.data.map(market => ({
                name: market.name,
                type: market.type,
                prices: market.data.map(point => ({
                    date: new Date(point.x).toISOString(),
                    price: point.y,
                    quantity: point.q
                }))
            }))
        };

        res.json(chartData);

    } catch (e) {
        winston.error('Error fetching price history:', e);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Skin.Broker - Recent Sales Data (WITH DATABASE STORAGE)
app.get('/api/recent-sales/:marketHashName', async (req, res) => {
    try {
        const marketHashName = decodeURIComponent(req.params.marketHashName);

        const apiKey = CONFIG.skinbroker_api_key || 'sbv1UvaYyGLofmw26Huqqadjkqi3TwvwTzPn6mDaRQD3Fta6hUOc';
        const url = `https://skin.broker/api/v1/item/sales?marketHashName=${encodeURIComponent(marketHashName)}&key=${apiKey}`;

        const response = await fetch(url);

        if (!response.ok) {
            return res.status(response.status).json({
                success: false,
                error: 'Unable to fetch sales data'
            });
        }

        let data;
        try {
            data = await response.json();
        } catch (jsonError) {
            winston.error('Error parsing recent sales JSON:', jsonError);
            return res.status(500).json({
                success: false,
                error: 'Invalid JSON response from sales API'
            });
        }

        if (!Array.isArray(data) || data.length === 0) {
            return res.json({
                success: true,
                sales: [],
                message: 'No recent sales data available'
            });
        }

        // Store sales in database for float-price correlation
        for (const sale of data) {
            try {
                await postgres.storeRecentSale(marketHashName, {
                    price: sale.price,
                    float: sale.float,
                    pattern: sale.pattern,
                    stickers: sale.stickers,
                    date: sale.time,
                    market: sale.market.name
                });
            } catch (e) {
                winston.warn(`Failed to store sale for ${marketHashName}:`, e.message);
            }
        }

        // Transform sales data
        const salesData = {
            success: true,
            name: marketHashName,
            totalSales: data.length,
            sales: data.map(sale => ({
                price: parseFloat(sale.price),
                float: sale.float ? parseFloat(sale.float) : null,
                pattern: sale.pattern,
                stickers: sale.stickers || [],
                date: sale.time,
                market: {
                    name: sale.market.name,
                    url: sale.market.url
                }
            })),
            // Calculate average sale price
            averagePrice: (data.reduce((sum, sale) => sum + parseFloat(sale.price), 0) / data.length).toFixed(2)
        };

        res.json(salesData);

    } catch (e) {
        winston.error('Error fetching recent sales:', e);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// UNIQUE FEATURE: Float Price Premium Calculator
// Calculate how much a specific float affects price
app.get('/api/float-price-premium/:marketHashName/:floatValue', async (req, res) => {
    try {
        const marketHashName = decodeURIComponent(req.params.marketHashName);
        const floatValue = parseFloat(req.params.floatValue);

        if (!marketHashName || isNaN(floatValue)) {
            return res.status(400).json({ error: 'Invalid parameters' });
        }

        // Calculate premium from database
        const premium = await postgres.calculateFloatPricePremium(marketHashName, floatValue);

        if (!premium.success) {
            return res.json({
                success: false,
                message: premium.message,
                recommendation: 'Check this item again later as more sales data is collected'
            });
        }

        // Add recommendation based on premium
        let recommendation = '';
        let dealQuality = 'fair';
        const premiumPercent = parseFloat(premium.premiumPercent);

        if (premiumPercent > 10) {
            recommendation = '🔥 Your float commands a significant premium! Price above market average.';
            dealQuality = 'premium';
        } else if (premiumPercent > 5) {
            recommendation = '💰 Your float is above average. Price slightly higher expected.';
            dealQuality = 'good';
        } else if (premiumPercent > -5) {
            recommendation = '📊 Standard float. Market average price expected.';
            dealQuality = 'fair';
        } else if (premiumPercent > -10) {
            recommendation = '💡 Below average float. Price slightly lower expected.';
            dealQuality = 'discount';
        } else {
            recommendation = '⚠️ Low float quality. Price significantly below average.';
            dealQuality = 'low';
        }

        res.json({
            success: true,
            itemName: marketHashName,
            floatAnalysis: {
                yourFloat: premium.yourFloat,
                estimatedPrice: `$${premium.estimatedPrice}`,
                marketAverage: `$${premium.marketAverage}`,
                premiumPercent: `${premiumPercent > 0 ? '+' : ''}${premium.premiumPercent}%`,
                priceRange: {
                    min: `$${premium.priceRange.min}`,
                    max: `$${premium.priceRange.max}`
                }
            },
            dataQuality: {
                sampleSize: premium.sampleSize,
                totalSales: premium.totalSales,
                reliability: premium.sampleSize > 5 ? 'high' : premium.sampleSize > 2 ? 'medium' : 'low'
            },
            recommendation: recommendation,
            dealQuality: dealQuality
        });

    } catch (e) {
        winston.error('Error calculating float premium:', e);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Skin.Broker - Market Statistics
app.get('/api/market-stats', async (req, res) => {
    try {
        const apiKey = CONFIG.skinbroker_api_key || 'sbv1UvaYyGLofmw26Huqqadjkqi3TwvwTzPn6mDaRQD3Fta6hUOc';
        const url = `https://skin.broker/api/v1/market/metrics?key=${apiKey}`;

        const response = await fetch(url);

        if (!response.ok) {
            return res.status(response.status).json({
                success: false,
                error: 'Unable to fetch market statistics'
            });
        }

        const data = await response.json();

        // Sort markets by value
        const sortedMarkets = data.markets.sort((a, b) => b.marketValue - a.marketValue);

        const stats = {
            success: true,
            timestamp: new Date().toISOString(),
            global: {
                totalMarketValue: data.total.totalMarketValue,
                totalMarketValueFormatted: `$${(data.total.totalMarketValue / 1000000).toFixed(1)}M`,
                totalItems: data.total.totalItemCount,
                totalItemsFormatted: `${(data.total.totalItemCount / 1000000).toFixed(1)}M`,
                totalMarkets: data.markets.length
            },
            topMarkets: sortedMarkets.slice(0, 10).map(market => ({
                name: market.market,
                items: market.items,
                marketValue: market.marketValue,
                marketValueFormatted: `$${(market.marketValue / 1000000).toFixed(2)}M`,
                averagePrice: (market.marketValue / market.items).toFixed(2)
            })),
            allMarkets: sortedMarkets.map(market => ({
                name: market.market,
                items: market.items,
                marketValue: market.marketValue
            }))
        };

        res.json(stats);

    } catch (e) {
        winston.error('Error fetching market stats:', e);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Skin.Broker - Get User Inventory Value
app.get('/api/inventory/:steamId', async (req, res) => {
    try {
        const steamId = req.params.steamId;

        if (!steamId || steamId.length < 17) {
            return res.status(400).json({ error: 'Invalid Steam ID' });
        }

        const apiKey = CONFIG.skinbroker_api_key || 'sbv1UvaYyGLofmw26Huqqadjkqi3TwvwTzPn6mDaRQD3Fta6hUOc';
        const url = `https://skin.broker/api/v2/inventory?steamId=${steamId}&key=${apiKey}`;

        const response = await fetch(url);

        if (!response.ok) {
            return res.status(response.status).json({
                success: false,
                error: 'Unable to fetch inventory'
            });
        }

        const data = await response.json();

        if (!data.success) {
            return res.json({
                success: false,
                error: 'Inventory not found or private'
            });
        }

        // Calculate total value and sort items by value
        const sortedItems = data.items.sort((a, b) => b.value - a.value);

        const inventoryData = {
            success: true,
            steamId: data.steamId,
            totalItems: data.items.length,
            totalValue: data.totalValue,
            totalValueFormatted: `$${data.totalValue.toFixed(2)}`,
            cacheTimestamp: data.timestamp,
            topItems: sortedItems.slice(0, 20).map(item => ({
                name: item.name,
                value: item.value,
                marketHashName: item.marketHashName,
                icon: item.icon
            })),
            // All items available if needed
            allItemsCount: data.items.length
        };

        res.json(inventoryData);

    } catch (e) {
        winston.error('Error fetching inventory:', e);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// ============================================================================
// PORTFOLIO MANAGEMENT ENDPOINTS - MOVED TO INVESTMENT API
// ============================================================================
// NOTE: All portfolio endpoints have been moved to cs2-investment-api (port 3003)
// This includes: add, get, stats, sales, deletions, allocations, snapshots, etc.
// [REMOVED] Portfolio endpoints (1424 lines) - moved to cs2-investment-api

// winston.info('Portfolio endpoints loaded successfully');

// =====================================================================
// CSGO-API INTEGRATION ENDPOINTS
// =====================================================================

const csgoAPI = require('./lib/csgoapi');

// Get float range for an item
app.get('/api/items/float-range/:itemName', async (req, res) => {
    try {
        const itemName = decodeURIComponent(req.params.itemName);
        const floatData = await csgoAPI.getFloatRange(itemName);

        if (!floatData) {
            return res.status(404).json({
                error: 'Item not found',
                item_name: itemName
            });
        }

        res.json({
            success: true,
            data: floatData
        });
    } catch (error) {
        winston.error('Float range lookup error:', error);
        res.status(500).json({
            error: 'Failed to fetch float range',
            message: error.message
        });
    }
});

// Get doppler phase by paint index
app.get('/api/items/doppler-phase/:paintIndex', (req, res) => {
    try {
        const paintIndex = req.params.paintIndex;
        const dopplerInfo = csgoAPI.getDopplerPhase(paintIndex);

        if (!dopplerInfo) {
            return res.status(404).json({
                error: 'Not a doppler phase',
                paint_index: paintIndex
            });
        }

        res.json({
            success: true,
            data: dopplerInfo
        });
    } catch (error) {
        winston.error('Doppler phase lookup error:', error);
        res.status(500).json({
            error: 'Failed to fetch doppler phase',
            message: error.message
        });
    }
});

// Get complete item metadata
app.get('/api/items/metadata/:itemName', async (req, res) => {
    try {
        const itemName = decodeURIComponent(req.params.itemName);
        const metadata = await csgoAPI.getItemMetadata(itemName);

        if (!metadata) {
            return res.status(404).json({
                error: 'Item not found',
                item_name: itemName
            });
        }

        res.json({
            success: true,
            data: metadata
        });
    } catch (error) {
        winston.error('Item metadata lookup error:', error);
        res.status(500).json({
            error: 'Failed to fetch item metadata',
            message: error.message
        });
    }
});

// OLD Search items endpoint - DEPRECATED (replaced by CS2 Item Cache version below)
// app.get('/api/items/search', async (req, res) => {
//     try {
//         const query = req.query.q || req.query.query;
//         const limit = parseInt(req.query.limit) || 20;
//
//         if (!query) {
//             return res.status(400).json({
//                 error: 'Missing search query',
//                 message: 'Provide ?q=query parameter'
//             });
//         }
//
//         const results = await csgoAPI.searchItems(query, limit);
//
//         res.json({
//             success: true,
//             query,
//             count: results.length,
//             results
//         });
//     } catch (error) {
//         winston.error('Item search error:', error);
//         res.status(500).json({
//             error: 'Failed to search items',
//             message: error.message
//         });
//     }
// });

// Get case contents
app.get('/api/items/case/:caseName', async (req, res) => {
    try {
        const caseName = decodeURIComponent(req.params.caseName);
        const caseData = await csgoAPI.getCaseContents(caseName);

        if (!caseData) {
            return res.status(404).json({
                error: 'Case not found',
                case_name: caseName
            });
        }

        res.json({
            success: true,
            data: caseData
        });
    } catch (error) {
        winston.error('Case lookup error:', error);
        res.status(500).json({
            error: 'Failed to fetch case contents',
            message: error.message
        });
    }
});

// Get cache status
app.get('/api/items/cache/status', async (req, res) => {
    try {
        const status = await csgoAPI.getCacheStatus();
        res.json(status);
    } catch (error) {
        winston.error('Cache status error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Clear cache (admin endpoint)
app.post('/api/items/cache/clear', async (req, res) => {
    try {
        const result = await csgoAPI.clearCache();
        res.json(result);
    } catch (error) {
        winston.error('Cache clear error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

winston.info('CSGO-API integration endpoints loaded');

// =====================================================================
// STEAM FEE CALCULATION ENDPOINTS
// =====================================================================

const steamFees = require('./lib/steam-fees');

// Calculate what seller receives from buyer's payment
app.post('/api/pricing/seller-receives', (req, res) => {
    try {
        const { buyer_price } = req.body;

        if (!buyer_price || isNaN(buyer_price)) {
            return res.status(400).json({
                error: 'Invalid buyer_price',
                message: 'Provide buyer_price as a number'
            });
        }

        const validation = steamFees.validatePrice(buyer_price);
        if (!validation.valid) {
            return res.status(400).json({
                error: 'Invalid price',
                message: validation.message
            });
        }

        const result = steamFees.calculateSellerReceives(buyer_price);

        res.json({
            success: true,
            ...result
        });
    } catch (error) {
        winston.error('Seller receives calculation error:', error);
        res.status(500).json({
            error: 'Failed to calculate seller amount',
            message: error.message
        });
    }
});

// Calculate what buyer needs to pay for seller to receive target amount
app.post('/api/pricing/buyer-price', (req, res) => {
    try {
        const { seller_amount } = req.body;

        if (!seller_amount || isNaN(seller_amount)) {
            return res.status(400).json({
                error: 'Invalid seller_amount',
                message: 'Provide seller_amount as a number'
            });
        }

        const validation = steamFees.validatePrice(seller_amount);
        if (!validation.valid) {
            return res.status(400).json({
                error: 'Invalid price',
                message: validation.message
            });
        }

        const result = steamFees.calculateBuyerPrice(seller_amount);

        res.json({
            success: true,
            ...result
        });
    } catch (error) {
        winston.error('Buyer price calculation error:', error);
        res.status(500).json({
            error: 'Failed to calculate buyer price',
            message: error.message
        });
    }
});

// Get detailed fee breakdown
app.post('/api/pricing/fee-breakdown', (req, res) => {
    try {
        const { buyer_price } = req.body;

        if (!buyer_price || isNaN(buyer_price)) {
            return res.status(400).json({
                error: 'Invalid buyer_price',
                message: 'Provide buyer_price as a number'
            });
        }

        const result = steamFees.getFeeBreakdown(buyer_price);

        res.json({
            success: true,
            ...result
        });
    } catch (error) {
        winston.error('Fee breakdown calculation error:', error);
        res.status(500).json({
            error: 'Failed to calculate fee breakdown',
            message: error.message
        });
    }
});

// Calculate profit after fees
app.post('/api/pricing/calculate-profit', (req, res) => {
    try {
        const { buy_price, current_market_price } = req.body;

        if (!buy_price || isNaN(buy_price) || !current_market_price || isNaN(current_market_price)) {
            return res.status(400).json({
                error: 'Invalid parameters',
                message: 'Provide buy_price and current_market_price as numbers'
            });
        }

        const result = steamFees.calculateProfit(buy_price, current_market_price);

        res.json({
            success: true,
            ...result
        });
    } catch (error) {
        winston.error('Profit calculation error:', error);
        res.status(500).json({
            error: 'Failed to calculate profit',
            message: error.message
        });
    }
});

// Get fee examples
app.get('/api/pricing/fee-examples', (req, res) => {
    try {
        const examples = steamFees.getFeeExamples();

        res.json({
            success: true,
            examples,
            note: 'Steam fees scale from 10% to 13.05% based on price'
        });
    } catch (error) {
        winston.error('Fee examples error:', error);
        res.status(500).json({
            error: 'Failed to get fee examples',
            message: error.message
        });
    }
});

winston.info('Steam fee calculation endpoints loaded');

// =====================================================================
// PORTFOLIO SNAPSHOTS & ADVANCED FEATURES - MOVED TO INVESTMENT API
// =====================================================================
// NOTE: All advanced portfolio features moved to cs2-investment-api (port 3003)
// This includes: snapshots, auth, webhooks, alerts, batch updates, etc.

// =====================================================================
// STEAM AUTHENTICATION ROUTES
// =====================================================================
// REMOVED: Old Passport.js Steam auth routes
// steamAuth.setupAuthRoutes(app, postgres);
// Note: Better Auth removed from CSFloat API - only needed in Investment API
// CSFloat API is public (float inspection for 500 extension users)

// =====================================================================
// STEAM INVENTORY ENDPOINTS - MOVED TO INVESTMENT API
// =====================================================================
// Steam Inventory endpoints (with preview mode support for onboarding)
// NOTE: Preview mode allows public access without auth for onboarding flow
// =====================================================================

// Get user's CS2 inventory (supports preview mode)
app.get('/api/steam/inventory/:steamId?', async (req, res) => {
    try {
        const isPreview = req.query.preview === 'true';

        // In preview mode, steamId is required in params (public lookup)
        const steamId = req.params.steamId;

        if (!steamId) {
            return res.status(400).json({
                success: false,
                error: 'Steam ID required'
            });
        }

        // Preview mode is always allowed (public access for onboarding)
        if (!isPreview) {
            return res.status(401).json({
                success: false,
                error: 'This endpoint requires preview=true parameter'
            });
        }

        const result = await steamInventory.getSteamInventory(steamId);

        // Add steamId to response for client convenience
        if (result.success) {
            result.steamId = steamId;
        }

        // In preview mode, enrich items with prices
        if (isPreview && result.success && result.items && result.items.length > 0) {
            let totalValue = 0;

            for (const item of result.items) {
                try {
                    if (item.market_hash_name) {
                        const priceData = await postgres.getCachedPrice(item.market_hash_name);

                        // Get the lowest price from available markets
                        let itemPrice = 0;
                        if (priceData?.prices) {
                            const marketPrices = [];
                            if (priceData.prices.buff163?.price_usd) marketPrices.push(priceData.prices.buff163.price_usd);
                            if (priceData.prices.csfloat?.price_usd) marketPrices.push(priceData.prices.csfloat.price_usd);
                            if (priceData.prices.skinport?.price_usd) marketPrices.push(priceData.prices.skinport.price_usd);
                            if (priceData.prices.marketCsgo?.price_usd) marketPrices.push(priceData.prices.marketCsgo.price_usd);

                            if (marketPrices.length > 0) {
                                itemPrice = Math.min(...marketPrices);
                            }
                        }

                        // Add price to item
                        item.price = parseFloat(itemPrice.toFixed(2));

                        if (itemPrice > 0) {
                            totalValue += itemPrice;
                        }
                    }
                } catch (e) {
                    winston.warn(`Failed to get price for ${item.market_hash_name}: ${e.message}`);
                    item.price = 0;
                }
            }

            // Add total value to response
            result.total_value = parseFloat(totalValue.toFixed(2));
        }

        res.json(result);
    } catch (error) {
        winston.error('Steam inventory fetch error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch inventory',
            message: error.message
        });
    }
});

// Get inventory value estimate
// NOTE: This endpoint has been moved to cs2-investment-api
// Commenting out to avoid requireAuth dependency issues
/*
app.get('/api/steam/inventory/:steamId?/value', requireAuth, async (req, res) => {
    try {
        // Use authenticated user's Steam ID if not provided in URL
        const steamId = req.params.steamId || req.user.steam_id;

        // Verify user can only access their own inventory
        if (req.user.steam_id !== steamId) {
            return res.status(403).json({
                success: false,
                error: 'Forbidden',
                message: 'You can only access your own inventory'
            });
        }

        const result = await steamInventory.getInventoryValue(steamId, postgres);
        res.json(result);
    } catch (error) {
        winston.error('Inventory value calculation error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to calculate inventory value',
            message: error.message
        });
    }
});
*/

// ============================================================================
// QUICK ACTIONS API - MOVED TO INVESTMENT API
// ============================================================================
// NOTE: These endpoints have been moved to cs2-investment-api on port 3003
// They are portfolio features and belong in the Investment API
/*
/**
 * Quick Add Investment - Streamlined endpoint for fast item addition
 * POST /api/portfolio/quick/add
 */
/*
app.post('/api/portfolio/quick/add',
    validate(z.object({
        userId: z.string().min(1),
        itemNames: z.array(z.string()).min(1).max(20),
        marketplace: z.string().optional().default('Steam')
    })),
    asyncHandler(async (req, res) => {
        const { userId, itemNames, marketplace } = req.body;
        const steamId = userId.replace('steam_', '');

        const results = [];
        const errors = [];

        for (const itemName of itemNames) {
            try {
                // Get current market price
                const priceData = await postgres.getCachedPrice(itemName);
                const currentPrice = priceData?.lowestPrice || 0;

                if (currentPrice === 0) {
                    errors.push({
                        itemName,
                        error: 'Price not found'
                    });
                    continue;
                }

                // Insert with current price as purchase price
                const result = await postgres.pool.query(`
                    INSERT INTO portfolio_investments (
                        user_id, user_steam_id, item_name, purchase_price,
                        quantity, marketplace, notes
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                    RETURNING id
                `, [
                    userId,
                    steamId,
                    itemName,
                    currentPrice,
                    1,
                    marketplace,
                    'Added via Quick Add'
                ]);

                results.push({
                    id: result.rows[0].id,
                    itemName,
                    purchasePrice: currentPrice,
                    success: true
                });
            } catch (error) {
                errors.push({
                    itemName,
                    error: error.message
                });
            }
        }

        res.json({
            success: true,
            added: results.length,
            failed: errors.length,
            results,
            errors: errors.length > 0 ? errors : undefined
        });
    })
);

/**
 * Quick Record Sale - Fast sale recording
 * POST /api/portfolio/quick/sell/:investmentId
 */
/*
app.post('/api/portfolio/quick/sell/:investmentId',
    validateParams(z.object({
        investmentId: z.string().regex(/^\d+$/).transform(Number)
    })),
    validate(z.object({
        salePrice: z.number().positive()
    })),
    asyncHandler(async (req, res) => {
        const { investmentId } = req.params;
        const { salePrice } = req.body;

        // Get investment details
        const invResult = await postgres.pool.query(`
            SELECT * FROM portfolio_investments WHERE id = $1
        `, [investmentId]);

        if (invResult.rows.length === 0) {
            throw new ApiError(404, 'Investment not found', 'NOT_FOUND');
        }

        const investment = invResult.rows[0];
        const quantityToSell = investment.quantity;
        const profitLoss = (salePrice - investment.purchase_price) * quantityToSell;
        const roiPercent = ((salePrice - investment.purchase_price) / investment.purchase_price) * 100;

        // Record the sale
        await postgres.pool.query(`
            INSERT INTO portfolio_sales (
                investment_id, user_id, item_name, quantity_sold,
                original_purchase_price, sale_price, marketplace,
                profit_loss, roi_percent, notes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `, [
            investmentId,
            investment.user_id,
            investment.item_name,
            quantityToSell,
            investment.purchase_price,
            salePrice,
            investment.marketplace,
            profitLoss,
            roiPercent,
            'Sold via Quick Sell'
        ]);

        // Mark investment as sold
        await postgres.pool.query(`
            UPDATE portfolio_investments
            SET is_sold = true, updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
        `, [investmentId]);

        res.json({
            success: true,
            sale: {
                investmentId,
                itemName: investment.item_name,
                quantitySold: quantityToSell,
                salePrice,
                profitLoss,
                roiPercent: roiPercent.toFixed(2)
            }
        });
    })
);

/**
 * Quick Price Check - Get current prices for multiple items
 * POST /api/portfolio/quick/price-check
 */
/*
app.post('/api/portfolio/quick/price-check',
    validate(z.object({
        itemNames: z.array(z.string()).min(1).max(50)
    })),
    asyncHandler(async (req, res) => {
        const { itemNames } = req.body;

        const prices = [];
        const notFound = [];

        for (const itemName of itemNames) {
            try {
                const priceData = await postgres.getCachedPrice(itemName);

                if (priceData && priceData.lowestPrice > 0) {
                    prices.push({
                        itemName,
                        lowestPrice: priceData.lowestPrice,
                        highestPrice: priceData.highestPrice,
                        markets: priceData.prices,
                        cachedAt: priceData.cached_at
                    });
                } else {
                    notFound.push(itemName);
                }
            } catch (error) {
                notFound.push(itemName);
            }
        }

        res.json({
            success: true,
            found: prices.length,
            notFound: notFound.length,
            prices,
            missing: notFound.length > 0 ? notFound : undefined
        });
    })
);
*/

// winston.info('Quick Actions API endpoints loaded');

// ============================================================================
// CS2 ITEM SEARCH API
// ============================================================================

const cs2ItemCache = require('./utils/cs2ItemCache');

/**
 * Search CS2 items - Used for autocomplete and item selection
 * GET /api/items/search?q=AK-47&limit=20
 * GET /api/items/search (returns all items, limited by limit param)
 */
app.get('/api/items/search',
    validateQuery(z.object({
        q: z.string().optional().default(''),
        limit: z.union([z.string().regex(/^\d+$/), z.number()]).transform(Number).optional().default(20)
    })),
    asyncHandler(async (req, res) => {
        const { q: query, limit } = req.query;

        const results = await cs2ItemCache.search(query, Math.min(limit, 100));

        res.json({
            success: true,
            query,
            count: results.length,
            items: results
        });
    })
);

/**
 * Get item by exact name
 * GET /api/items/:itemName
 */
app.get('/api/items/:itemName',
    asyncHandler(async (req, res) => {
        const { itemName } = req.params;

        const item = await cs2ItemCache.getItemByName(decodeURIComponent(itemName));

        if (!item) {
            throw new ApiError(404, 'Item not found', 'ITEM_NOT_FOUND');
        }

        res.json({
            success: true,
            item
        });
    })
);

/**
 * Get cache statistics
 * GET /api/items/cache/stats
 */
app.get('/api/items/cache/stats',
    asyncHandler(async (req, res) => {
        const stats = cs2ItemCache.getStats();

        res.json({
            success: true,
            cache: stats
        });
    })
);

/**
 * Force refresh cache (admin use)
 * POST /api/items/cache/refresh
 */
app.post('/api/items/cache/refresh',
    asyncHandler(async (req, res) => {
        await cs2ItemCache.forceRefresh();
        const stats = cs2ItemCache.getStats();

        res.json({
            success: true,
            message: 'Cache refreshed successfully',
            cache: stats
        });
    })
);

winston.info('CS2 Item Search API endpoints loaded');

// ============================================================================
// STEAM INVENTORY INTEGRATION - MOVED TO INVESTMENT API
// ============================================================================
// NOTE: These endpoints have been moved to cs2-investment-api on port 3003
/*
// Sync inventory to portfolio
app.post('/api/steam/inventory/sync', requireAuth, async (req, res) => {
    try {
        const steamId = req.user.steam_id;
        const { selected_items = [] } = req.body;

        // Get inventory
        const inventoryResult = await steamInventory.getSteamInventory(steamId);

        if (!inventoryResult.success) {
            return res.status(400).json(inventoryResult);
        }

        let added = 0;
        let errors = [];

        // Filter items to sync (either all or selected)
        const itemsToSync = selected_items.length > 0
            ? inventoryResult.items.filter(item => selected_items.includes(item.assetid))
            : inventoryResult.items;

        // Add each item to portfolio
        for (const item of itemsToSync) {
            try {
                // Skip non-marketable items (can't be sold)
                if (!item.marketable) {
                    winston.debug(`Skipping non-marketable item: ${item.market_name}`);
                    continue;
                }

                // Get market price
                let price = 0;
                if (item.market_hash_name) {
                    const cachedPrice = await postgres.getCachedPrice(item.market_hash_name);
                    price = cachedPrice?.lowestPrice || 0;
                }

                // Check for duplicates
                const duplicateCheck = await postgres.pool.query(`
                    SELECT id FROM portfolio_investments
                    WHERE user_steam_id = $1 AND item_name = $2 AND is_sold = false
                    LIMIT 1
                `, [steamId, item.market_name]);

                if (duplicateCheck.rows.length > 0) {
                    winston.debug(`Skipping duplicate item: ${item.market_name}`);
                    errors.push({
                        item: item.market_name,
                        error: 'Item already exists in portfolio'
                    });
                    continue;
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

                winston.info(`Added to portfolio: ${item.market_name} - $${price}`);
                added++;
            } catch (error) {
                winston.error(`Error adding ${item.market_name}:`, error);
                errors.push({
                    item: item.market_name,
                    error: error.message
                });
            }
        }

        res.json({
            success: true,
            message: `Synced ${added} items from Steam inventory`,
            added: added,
            total_items: itemsToSync.length,
            errors: errors.length > 0 ? errors : undefined
        });

    } catch (error) {
        winston.error('Inventory sync error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to sync inventory',
            message: error.message
        });
    }
});

// TEST ENDPOINT - Remove auth requirement for testing
// WARNING: This exposes inventory data publicly! Remove in production!
app.get('/api/steam/inventory/test/:steamId', async (req, res) => {
    try {
        const { steamId } = req.params;
        const result = await steamInventory.getSteamInventory(steamId);
        res.json(result);
    } catch (error) {
        winston.error('Test inventory fetch error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch inventory',
            message: error.message
        });
    }
});
*/

// winston.info('Steam inventory endpoints loaded');

// =====================================================================
// HEALTH CHECK ENDPOINT
// =====================================================================
app.get('/health', asyncHandler(async (req, res) => {
    const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        service: 'cs2-float-api',
        version: '1.4.1',
        checks: {
            database: 'unknown',
            bots: 'unknown',
            queue: 'unknown'
        }
    };

    // Check database connection
    try {
        await postgres.pool.query('SELECT 1');
        health.checks.database = 'healthy';
    } catch (error) {
        health.checks.database = 'unhealthy';
        health.status = 'degraded';
    }

    // Check bot status
    health.checks.bots = botController.hasBotOnline() ? 'healthy' : 'unhealthy';
    if (!botController.hasBotOnline()) {
        health.status = 'degraded';
    }

    // Check queue status
    health.checks.queue = queue.size() < (CONFIG.max_queue_size || 1000) ? 'healthy' : 'overloaded';

    const statusCode = health.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(health);
}));

winston.info('Health check endpoint loaded at /health');

// =====================================================================
// ERROR HANDLERS (Must be last!)
// =====================================================================
// Apply general rate limiter to all API routes
app.use('/api', generalLimiter);

// 404 handler for undefined routes
app.use(notFoundHandler);

// Global error handler (must be last)
app.use(errorHandler);

winston.info('Error handlers and rate limiting configured');

const http_server = require('http').Server(app);

// Fix connection leaks: Add timeouts and connection limits
http_server.timeout = 120000; // 120 second timeout
http_server.keepAliveTimeout = 65000; // 65 seconds (must be > load balancer)
http_server.headersTimeout = 70000; // 70 seconds (slightly higher than keepAlive)
http_server.maxHeadersCount = 100; // Limit headers per request

// Track active connections for monitoring
let activeConnections = 0;
http_server.on('connection', (socket) => {
    activeConnections++;
    socket.once('close', () => {
        activeConnections--;
    });

    // Force close hung connections after timeout
    socket.setTimeout(125000); // 125 seconds, slightly higher than server timeout
    socket.on('timeout', () => {
        winston.warn('Socket timeout, destroying connection');
        socket.destroy();
    });
});

// Log connection stats periodically
setInterval(() => {
    if (activeConnections > 50) {
        winston.warn(`High connection count: ${activeConnections} active connections`);
    }
}, 60000); // Check every minute
http_server.listen(CONFIG.http.port);
winston.info('Listening for HTTP on port: ' + CONFIG.http.port);

// Initialize CS2 item cache
(async () => {
    try {
        await cs2ItemCache.initialize();
        winston.info('CS2 item cache initialized successfully');
    } catch (error) {
        winston.error('Failed to initialize CS2 item cache:', error.message);
        winston.warn('Item search functionality may be limited until cache is populated');
    }
})();

queue.process(CONFIG.logins.length, botController, async (job) => {
    const itemData = await botController.lookupFloat(job.data.link);
    winston.debug(`Received itemData for ${job.data.link.getParams().a}`);

    // Save and remove the delay attribute
    let delay = itemData.delay;
    delete itemData.delay;

    // add the item info to the DB
    await postgres.insertItemData(itemData.iteminfo, job.data.price);

    // Get rank, annotate with game files
    itemData.iteminfo = Object.assign(itemData.iteminfo, await postgres.getItemRank(itemData.iteminfo.a));
    gameData.addAdditionalItemProperties(itemData.iteminfo);

    itemData.iteminfo = utils.removeNullValues(itemData.iteminfo);
    itemData.iteminfo.stickers = itemData.iteminfo.stickers.map((s) => utils.removeNullValues(s));
    itemData.iteminfo.keychains = itemData.iteminfo.keychains.map((s) => utils.removeNullValues(s));

    job.data.job.setResponse(job.data.link.getParams().a, itemData.iteminfo);

    return delay;
});

queue.on('job failed', (job, err) => {
    const params = job.data.link.getParams();
    winston.warn(`Job Failed! S: ${params.s} A: ${params.a} D: ${params.d} M: ${params.m} IP: ${job.ip}, Err: ${(err || '').toString()}`);

    job.data.job.setResponse(params.a, errors.TTLExceeded);
});
