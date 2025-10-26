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

app.use(function (error, req, res, next) {
    // Handle bodyParser errors
    if (error instanceof SyntaxError) {
        errors.BadBody.respond(res);
    }
    else next();
});


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

app.get('/stats', (req, res) => {
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
                const apiKey = CONFIG.skinbroker_api_key || 'sbv1eDIL09Ccfvj3KTcgMVTwCKk8echbPWEdX60CgrsLiJl4NGuL';
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
        const apiKey = CONFIG.skinbroker_api_key || 'sbv1eDIL09Ccfvj3KTcgMVTwCKk8echbPWEdX60CgrsLiJl4NGuL';
        const url = `https://skin.broker/api/v1/item?marketHashName=${encodeURIComponent(marketHashName)}&key=${apiKey}`;

        const response = await fetch(url);

        if (!response.ok) {
            winston.warn(`Skin.Broker API returned status ${response.status}`);
            return res.status(response.status).json({
                success: false,
                error: 'Unable to fetch pricing data'
            });
        }

        const data = await response.json();

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

        const apiKey = CONFIG.skinbroker_api_key || 'sbv1eDIL09Ccfvj3KTcgMVTwCKk8echbPWEdX60CgrsLiJl4NGuL';
        const url = `https://skin.broker/api/v2/item/chart?marketHashName=${encodeURIComponent(marketHashName)}&timeframe=${timeframe}&key=${apiKey}`;

        const response = await fetch(url);

        if (!response.ok) {
            return res.status(response.status).json({
                success: false,
                error: 'Unable to fetch price history'
            });
        }

        const data = await response.json();

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

        const apiKey = CONFIG.skinbroker_api_key || 'sbv1eDIL09Ccfvj3KTcgMVTwCKk8echbPWEdX60CgrsLiJl4NGuL';
        const url = `https://skin.broker/api/v1/item/sales?marketHashName=${encodeURIComponent(marketHashName)}&key=${apiKey}`;

        const response = await fetch(url);

        if (!response.ok) {
            return res.status(response.status).json({
                success: false,
                error: 'Unable to fetch sales data'
            });
        }

        const data = await response.json();

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
        const apiKey = CONFIG.skinbroker_api_key || 'sbv1eDIL09Ccfvj3KTcgMVTwCKk8echbPWEdX60CgrsLiJl4NGuL';
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

        const apiKey = CONFIG.skinbroker_api_key || 'sbv1eDIL09Ccfvj3KTcgMVTwCKk8echbPWEdX60CgrsLiJl4NGuL';
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

// Helper function to calculate trade risk
function calculateTradeRisk(history) {
    if (!history || history.length === 0) {
        return {
            risk: 'UNKNOWN',
            message: 'No trade history available',
            canReverse: false
        };
    }

    const latestTrade = history[0];
    const tradeDate = new Date(latestTrade.date);
    const now = new Date();
    const daysSinceLastTrade = (now - tradeDate) / (1000 * 60 * 60 * 24);

    if (daysSinceLastTrade < 7) {
        return {
            risk: 'HIGH',
            message: '⚠️ Item traded within 7 days - REVERSIBLE!',
            canReverse: true,
            daysRemaining: Math.ceil(7 - daysSinceLastTrade),
            lastTradeDate: tradeDate.toISOString(),
            reversibleUntil: new Date(tradeDate.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
        };
    }

    return {
        risk: 'SAFE',
        message: '✅ Safe to trade (>7 days since last trade)',
        canReverse: false,
        daysSinceLastTrade: Math.floor(daysSinceLastTrade),
        lastTradeDate: tradeDate.toISOString()
    };
}

const http_server = require('http').Server(app);
http_server.listen(CONFIG.http.port);
winston.info('Listening for HTTP on port: ' + CONFIG.http.port);

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
