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

// =====================================================================
// STEAM AUTHENTICATION SETUP
// =====================================================================
const session = require('express-session');
const passport = require('passport');
const steamAuth = require('./lib/steam-auth');
const steamInventory = require('./lib/steam-inventory');

// Session middleware
app.use(session({
    secret: process.env.SESSION_SECRET || 'cs2float-session-secret-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: 'lax'
    }
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Configure Steam authentication
steamAuth.configureSteamAuth(postgres);
winston.info('Steam authentication configured');



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

// ============================================================================
// PORTFOLIO MANAGEMENT ENDPOINTS
// ============================================================================

/**
 * Add new investment to portfolio
 * POST /api/portfolio/add
 */
app.post('/api/portfolio/add', async (req, res) => {
    try {
        const {
            userId,
            itemName,
            purchasePrice,
            quantity = 1,
            inspectLink,
            marketplace = 'Steam',
            notes
        } = req.body;

        if (!userId || !itemName || !purchasePrice) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: userId, itemName, purchasePrice'
            });
        }

        let floatData = null;
        let rarityData = null;
        let priceData = null;
        let investmentScore = null;

        // If inspect link provided, fetch float data
        if (inspectLink) {
            try {
                const link = new InspectURL(inspectLink);

                if (link.valid) {
                    const itemData = await postgres.getItemData([link.link]);
                    if (itemData.length > 0) {
                        floatData = itemData[0];
                    }
                }
            } catch (e) {
                winston.warn(`Failed to fetch float data: ${e.message}`);
            }
        }

        // Get rarity data if we have float data
        if (floatData) {
            try {
                rarityData = await postgres.getFloatRarity(
                    floatData.defindex,
                    floatData.paintindex,
                    floatData.floatvalue
                );
            } catch (e) {
                winston.warn(`Failed to get rarity data: ${e.message}`);
            }
        }

        // Get current price data
        try {
            priceData = await postgres.getCachedPrice(itemName);
        } catch (e) {
            winston.warn(`Failed to get price data: ${e.message}`);
        }

        // Calculate Investment Score if we have enough data
        if (rarityData && priceData) {
            try {
                investmentScore = await calculateInvestmentScore({
                    floatRarity: rarityData.rarityScore || 50,
                    patternIndex: floatData?.paintseed || 0,
                    itemName: itemName,
                    liquidity: priceData.prices?.csfloat?.listings || 0,
                    currentPrice: priceData.lowestPrice || purchasePrice,
                    defindex: floatData?.defindex || 0,
                    paintindex: floatData?.paintindex || 0
                });
            } catch (e) {
                winston.warn(`Failed to calculate investment score: ${e.message}`);
            }
        }

        // Detect pattern tier (Blue Gems, etc.)
        let patternTier = 'Standard';
        let patternMultiplier = 1.0;
        if (floatData) {
            const patternInfo = await detectPatternTier(itemName, floatData.paintseed);
            patternTier = patternInfo.tier;
            patternMultiplier = patternInfo.multiplier;
        }

        // Insert into database
        const result = await postgres.pool.query(`
            INSERT INTO portfolio_investments (
                user_id, item_name, purchase_price, quantity, marketplace,
                float_value, pattern_index, defindex, paintindex,
                wear, is_stattrak,
                investment_score, investment_score_breakdown,
                float_rarity_score, pattern_tier, pattern_value_multiplier,
                stickers, notes
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
            RETURNING id
        `, [
            userId,
            itemName,
            purchasePrice,
            quantity,
            marketplace,
            floatData?.floatvalue || null,
            floatData?.paintseed || null,
            floatData?.defindex || null,
            floatData?.paintindex || null,
            floatData ? getWearFromFloat(floatData.floatvalue) : null,
            floatData?.killeatervalue !== null,
            investmentScore?.overall || null,
            investmentScore ? JSON.stringify(investmentScore.breakdown) : null,
            rarityData?.rarityScore || null,
            patternTier,
            patternMultiplier,
            floatData?.stickers ? JSON.stringify(floatData.stickers) : null,
            notes || null
        ]);

        res.json({
            success: true,
            investment: {
                id: result.rows[0].id,
                itemName: itemName,
                purchasePrice: purchasePrice,
                floatValue: floatData?.floatvalue || null,
                investmentScore: investmentScore?.overall || null,
                patternTier: patternTier,
                rarityTier: rarityData?.rarityTier || null
            }
        });

    } catch (e) {
        winston.error('Error adding portfolio investment:', e);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

/**
 * Get user portfolio
 * GET /api/portfolio/:userId
 */
app.get('/api/portfolio/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;

        if (!userId) {
            return res.status(400).json({
                success: false,
                error: 'Missing userId'
            });
        }

        // Get all investments
        const result = await postgres.pool.query(`
            SELECT
                pi.*,
                COALESCE(SUM(ps.quantity_sold), 0) as sold_quantity,
                COALESCE(SUM(ps.profit_loss), 0) as realized_profit
            FROM portfolio_investments pi
            LEFT JOIN portfolio_sales ps ON pi.id = ps.investment_id
            WHERE pi.user_id = $1
            GROUP BY pi.id
            ORDER BY pi.created_at DESC
        `, [userId]);

        const investments = result.rows;

        // Handle empty portfolio
        if (investments.length === 0) {
            return res.json({
                success: true,
                investments: []
            });
        }

        // Enrich with current prices
        for (const inv of investments) {
            try {
                const priceData = await postgres.getCachedPrice(inv.item_name);
                inv.current_price = priceData?.lowestPrice || 0;

                // Calculate unrealized profit
                const remaining = inv.quantity - inv.sold_quantity;
                inv.unrealized_profit = (inv.current_price - inv.purchase_price) * remaining;
                inv.unrealized_roi = inv.purchase_price > 0
                    ? ((inv.unrealized_profit / (inv.purchase_price * remaining)) * 100)
                    : 0;

                // Total profit
                inv.total_profit = parseFloat(inv.realized_profit) + inv.unrealized_profit;
            } catch (e) {
                winston.warn(`Failed to get price for ${inv.item_name}:`, e.message);
                inv.current_price = 0;
                inv.unrealized_profit = 0;
                inv.unrealized_roi = 0;
            }
        }

        res.json({
            success: true,
            investments: investments
        });

    } catch (e) {
        winston.error('Error fetching portfolio:', e);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

/**
 * Get portfolio statistics
 * GET /api/portfolio/stats/:userId
 */
app.get('/api/portfolio/stats/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;

        // Get investments with sales
        const result = await postgres.pool.query(`
            SELECT
                pi.id,
                pi.item_name,
                pi.purchase_price,
                pi.quantity,
                pi.investment_score,
                COALESCE(SUM(ps.quantity_sold), 0) as sold_quantity,
                COALESCE(SUM(ps.profit_loss), 0) as realized_profit
            FROM portfolio_investments pi
            LEFT JOIN portfolio_sales ps ON pi.id = ps.investment_id
            WHERE pi.user_id = $1
            GROUP BY pi.id
        `, [userId]);

        const investments = result.rows;

        // Handle empty portfolio
        if (investments.length === 0) {
            return res.json({
                success: true,
                stats: {
                    totalInvested: 0,
                    currentValue: 0,
                    realizedProfit: 0,
                    unrealizedProfit: 0,
                    totalProfit: 0,
                    totalROI: 0,
                    itemCount: 0,
                    avgInvestmentScore: 0
                }
            });
        }

        let totalInvested = 0;
        let currentValue = 0;
        let realizedProfit = 0;
        let itemCount = investments.length;
        let avgInvestmentScore = 0;

        // Calculate stats
        for (const inv of investments) {
            totalInvested += parseFloat(inv.purchase_price) * inv.quantity;
            realizedProfit += parseFloat(inv.realized_profit);

            // Get current price
            try {
                const priceData = await postgres.getCachedPrice(inv.item_name);
                const remaining = inv.quantity - inv.sold_quantity;
                currentValue += (priceData?.lowestPrice || 0) * remaining;
            } catch (e) {
                winston.warn(`Failed to get price for ${inv.item_name}`);
            }

            avgInvestmentScore += inv.investment_score || 0;
        }

        avgInvestmentScore = itemCount > 0 ? avgInvestmentScore / itemCount : 0;

        const unrealizedProfit = currentValue - totalInvested + realizedProfit;
        const totalProfit = realizedProfit + unrealizedProfit;
        const totalROI = totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0;

        res.json({
            success: true,
            stats: {
                totalInvested: parseFloat(totalInvested.toFixed(2)),
                currentValue: parseFloat(currentValue.toFixed(2)),
                realizedProfit: parseFloat(realizedProfit.toFixed(2)),
                unrealizedProfit: parseFloat(unrealizedProfit.toFixed(2)),
                totalProfit: parseFloat(totalProfit.toFixed(2)),
                totalROI: parseFloat(totalROI.toFixed(2)),
                itemCount: itemCount,
                avgInvestmentScore: parseFloat(avgInvestmentScore.toFixed(1))
            }
        });

    } catch (e) {
        winston.error('Error calculating portfolio stats:', e);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

/**
 * Record a sale
 * POST /api/portfolio/sale
 */
app.post('/api/portfolio/sale', async (req, res) => {
    try {
        const {
            investmentId,
            quantity,
            salePrice,
            marketplace = 'Steam',
            notes
        } = req.body;

        if (!investmentId || !quantity || !salePrice) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: investmentId, quantity, salePrice'
            });
        }

        // Get investment
        const invResult = await postgres.pool.query(`
            SELECT * FROM portfolio_investments WHERE id = $1
        `, [investmentId]);

        if (invResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Investment not found'
            });
        }

        const investment = invResult.rows[0];

        // Calculate profit/loss
        const profitLoss = (salePrice - investment.purchase_price) * quantity;
        const roiPercent = ((salePrice - investment.purchase_price) / investment.purchase_price) * 100;

        // Insert sale record
        await postgres.pool.query(`
            INSERT INTO portfolio_sales (
                investment_id, user_id, quantity_sold, sale_price,
                marketplace, profit_loss, roi_percent, notes
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
            investmentId,
            investment.user_id,
            quantity,
            salePrice,
            marketplace,
            profitLoss,
            roiPercent,
            notes || null
        ]);

        // Check if fully sold
        const salesResult = await postgres.pool.query(`
            SELECT SUM(quantity_sold) as total_sold
            FROM portfolio_sales
            WHERE investment_id = $1
        `, [investmentId]);

        const totalSold = parseInt(salesResult.rows[0].total_sold);

        if (totalSold >= investment.quantity) {
            // Mark as fully sold
            await postgres.pool.query(`
                UPDATE portfolio_investments
                SET is_sold = true, updated_at = NOW()
                WHERE id = $1
            `, [investmentId]);
        }

        res.json({
            success: true,
            sale: {
                investmentId: investmentId,
                quantity: quantity,
                salePrice: salePrice,
                profitLoss: parseFloat(profitLoss.toFixed(2)),
                roiPercent: parseFloat(roiPercent.toFixed(2)),
                isFullySold: totalSold >= investment.quantity
            }
        });

    } catch (e) {
        winston.error('Error recording sale:', e);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

/**
 * Delete investment
 * DELETE /api/portfolio/delete/:investmentId
 */
app.delete('/api/portfolio/delete/:investmentId', async (req, res) => {
    try {
        const investmentId = req.params.investmentId;

        // Delete investment (CASCADE will delete associated sales)
        const result = await postgres.pool.query(`
            DELETE FROM portfolio_investments
            WHERE id = $1
            RETURNING id
        `, [investmentId]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Investment not found'
            });
        }

        res.json({
            success: true,
            message: 'Investment deleted successfully'
        });

    } catch (e) {
        winston.error('Error deleting investment:', e);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// ============================================================================
// INVESTMENT SCORING SYSTEM
// ============================================================================

/**
 * Calculate Investment Score for an item
 * POST /api/investment-score
 */
app.post('/api/investment-score', async (req, res) => {
    try {
        const { itemName, floatValue, patternIndex, defindex, paintindex } = req.body;

        if (!itemName || floatValue === undefined) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: itemName, floatValue'
            });
        }

        // 1. Get float rarity
        let rarityData = null;
        if (defindex && paintindex) {
            rarityData = await postgres.getFloatRarity(defindex, paintindex, floatValue);
        }

        // 2. Get current prices
        const priceData = await postgres.getCachedPrice(itemName);

        // 3. Calculate Investment Score
        const score = await calculateInvestmentScore({
            floatRarity: rarityData?.rarityScore || 50,
            patternIndex: patternIndex || 0,
            itemName: itemName,
            liquidity: priceData?.prices?.csfloat?.listings || 0,
            currentPrice: priceData?.lowestPrice || 0,
            defindex: defindex || 0,
            paintindex: paintindex || 0
        });

        // 4. Get pattern info
        const patternInfo = await detectPatternTier(itemName, patternIndex || 0);

        res.json({
            success: true,
            itemName: itemName,
            floatValue: floatValue,
            investmentScore: score,
            patternInfo: patternInfo,
            rarityInfo: rarityData || null
        });

    } catch (e) {
        winston.error('Error calculating investment score:', e);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// ============================================================================
// PORTFOLIO HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate Investment Score (1-10 scale)
 */
async function calculateInvestmentScore(data) {
    const {
        floatRarity,      // 0-100 from getFloatRarity()
        patternIndex,
        itemName,
        liquidity,
        currentPrice,
        defindex,
        paintindex
    } = data;

    // 1. Float Rarity Score (25%)
    const floatScore = floatRarity / 10; // Convert 0-100 to 0-10

    // 2. Pattern Value Score (20%)
    const patternInfo = await detectPatternTier(itemName, patternIndex);
    const patternScore = patternInfo.score;

    // 3. Liquidity Score (20%)
    const liquidityScore = calculateLiquidityScore(liquidity);

    // 4. Weapon Popularity Score (15%)
    const weaponScore = getWeaponPopularity(itemName);

    // 5. Price Trend Score (15%)
    const trendScore = await calculatePriceTrend(itemName);

    // 6. Volatility Score (10%)
    const volatilityScore = await calculateVolatility(itemName);

    // Weighted average
    const overall = (
        floatScore * 0.25 +
        patternScore * 0.20 +
        liquidityScore * 0.20 +
        weaponScore * 0.15 +
        trendScore * 0.15 +
        volatilityScore * 0.10
    );

    return {
        overall: Math.round(overall * 10) / 10,
        breakdown: {
            float_rarity: parseFloat(floatScore.toFixed(1)),
            pattern_value: parseFloat(patternScore.toFixed(1)),
            liquidity: parseFloat(liquidityScore.toFixed(1)),
            weapon_popularity: parseFloat(weaponScore.toFixed(1)),
            price_trend: parseFloat(trendScore.toFixed(1)),
            volatility: parseFloat(volatilityScore.toFixed(1))
        }
    };
}

/**
 * Detect pattern tier (Blue Gems, Fade, Doppler, etc.)
 */
async function detectPatternTier(itemName, patternIndex) {
    // Check Blue Gem database
    if (itemName.includes('Case Hardened')) {
        const result = await postgres.pool.query(`
            SELECT tier, blue_percentage, value_multiplier, description
            FROM blue_gem_patterns
            WHERE weapon_type = $1 AND pattern_index = $2
        `, ['AK-47', patternIndex]); // TODO: Extract weapon type from itemName

        if (result.rows.length > 0) {
            const pattern = result.rows[0];
            return {
                tier: pattern.tier,
                multiplier: parseFloat(pattern.value_multiplier),
                description: pattern.description,
                score: getTierScore(pattern.tier)
            };
        }
    }

    // TODO: Add Fade, Doppler, Crimson Web detection

    return {
        tier: 'Standard',
        multiplier: 1.0,
        description: 'Standard pattern',
        score: 5.0
    };
}

function getTierScore(tier) {
    if (tier === 'Tier 1') return 10.0;
    if (tier === 'Tier 2') return 9.0;
    if (tier === 'Tier 3') return 8.0;
    return 5.0;
}

/**
 * Calculate liquidity score based on number of listings
 */
function calculateLiquidityScore(listings) {
    if (listings > 1000) return 10.0;
    if (listings > 500) return 9.0;
    if (listings > 100) return 7.5;
    if (listings > 50) return 6.0;
    if (listings > 10) return 4.0;
    return 2.0;
}

/**
 * Get weapon popularity score
 */
function getWeaponPopularity(itemName) {
    const sWeapons = ['Knife', 'Karambit', 'Butterfly', 'M9', 'Bayonet',
                      'AK-47', 'M4A4', 'M4A1-S', 'AWP', 'Gloves'];
    const aWeapons = ['Desert Eagle', 'USP-S', 'Glock-18', 'P250'];
    const bWeapons = ['Galil AR', 'FAMAS', 'Five-SeveN', 'CZ75-Auto'];

    if (sWeapons.some(w => itemName.includes(w))) return 10.0;
    if (aWeapons.some(w => itemName.includes(w))) return 8.0;
    if (bWeapons.some(w => itemName.includes(w))) return 6.0;
    return 4.0;
}

/**
 * Calculate price trend score from historical data
 */
async function calculatePriceTrend(itemName) {
    try {
        const history = await postgres.getPriceHistory(itemName, 30);

        if (history.length < 7) return 5.0;

        const recentPrice = history[0]?.price_usd || 0;
        const oldPrice = history[history.length - 1]?.price_usd || 0;

        if (oldPrice === 0) return 5.0;

        const percentChange = ((recentPrice - oldPrice) / oldPrice) * 100;

        // Score based on trend direction
        if (percentChange > 30) return 10.0; // Strong uptrend
        if (percentChange > 15) return 8.5;
        if (percentChange > 5) return 7.0;
        if (percentChange > -5) return 5.0; // Flat
        if (percentChange > -15) return 3.0;
        return 1.0; // Strong downtrend
    } catch (e) {
        winston.warn(`Failed to calculate price trend for ${itemName}:`, e.message);
        return 5.0; // Default neutral score
    }
}

/**
 * Calculate volatility score (lower volatility = higher score)
 */
async function calculateVolatility(itemName) {
    try {
        const history = await postgres.getPriceHistory(itemName, 30);

        if (history.length < 7) return 5.0;

        const prices = history.map(h => h.price_usd || 0).filter(p => p > 0);
        if (prices.length === 0) return 5.0;

        const mean = prices.reduce((a, b) => a + b, 0) / prices.length;

        const variance = prices.reduce((sum, price) => {
            return sum + Math.pow(price - mean, 2);
        }, 0) / prices.length;

        const stdDev = Math.sqrt(variance);
        const cv = (stdDev / mean) * 100; // Coefficient of variation

        // Lower CV = more stable = higher score
        if (cv < 5) return 10.0;  // Very stable
        if (cv < 10) return 8.0;
        if (cv < 20) return 6.0;
        if (cv < 30) return 4.0;
        return 2.0; // Very volatile
    } catch (e) {
        winston.warn(`Failed to calculate volatility for ${itemName}:`, e.message);
        return 5.0;
    }
}

/**
 * Get wear from float value
 */
function getWearFromFloat(floatValue) {
    if (floatValue < 0.07) return 'FN';
    if (floatValue < 0.15) return 'MW';
    if (floatValue < 0.38) return 'FT';
    if (floatValue < 0.45) return 'WW';
    return 'BS';
}

// ============================================================================
// ENHANCED PORTFOLIO ENDPOINTS (Inspired by SkinWatch/SkinVault)
// ============================================================================

/**
 * Get Asset Allocation
 * GET /api/portfolio/allocation/:userId
 */
app.get('/api/portfolio/allocation/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;

        // Get all unsold investments
        const result = await postgres.pool.query(`
            SELECT
                pi.item_name,
                pi.purchase_price,
                pi.quantity,
                COALESCE(SUM(ps.quantity_sold), 0) as sold_quantity
            FROM portfolio_investments pi
            LEFT JOIN portfolio_sales ps ON pi.id = ps.investment_id
            WHERE pi.user_id = $1 AND pi.is_sold = false
            GROUP BY pi.id
        `, [userId]);

        const investments = result.rows;

        // Handle empty portfolio
        if (investments.length === 0) {
            return res.json({
                success: true,
                totalValue: 0,
                allocation: {},
                categories: []
            });
        }

        // Calculate asset allocation
        const allocation = {};
        let totalValue = 0;

        for (const inv of investments) {
            // Get current price
            let currentPrice = inv.purchase_price;
            try {
                const priceData = await postgres.getCachedPrice(inv.item_name);
                currentPrice = priceData?.lowestPrice || inv.purchase_price;
            } catch (e) {
                winston.warn(`Failed to get price for ${inv.item_name}`);
            }

            const remaining = inv.quantity - inv.sold_quantity;
            const value = currentPrice * remaining;
            totalValue += value;

            // Categorize by item type
            const category = categorizeItem(inv.item_name);
            allocation[category] = (allocation[category] || 0) + value;
        }

        // Convert to percentages
        const allocationPercentages = {};
        Object.keys(allocation).forEach(category => {
            allocationPercentages[category] = {
                value: parseFloat(allocation[category].toFixed(2)),
                percentage: totalValue > 0 ? parseFloat(((allocation[category] / totalValue) * 100).toFixed(2)) : 0
            };
        });

        res.json({
            success: true,
            totalValue: parseFloat(totalValue.toFixed(2)),
            allocation: allocationPercentages,
            categories: Object.keys(allocationPercentages).sort()
        });

    } catch (e) {
        winston.error('Error calculating asset allocation:', e);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            code: 'ALLOCATION_ERROR'
        });
    }
});

/**
 * Get Portfolio Health Metrics
 * GET /api/portfolio/health/:userId
 */
app.get('/api/portfolio/health/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;

        // Get portfolio data
        const result = await postgres.pool.query(`
            SELECT
                pi.*,
                COALESCE(SUM(ps.quantity_sold), 0) as sold_quantity,
                COALESCE(SUM(ps.profit_loss), 0) as realized_profit
            FROM portfolio_investments pi
            LEFT JOIN portfolio_sales ps ON pi.id = ps.investment_id
            WHERE pi.user_id = $1
            GROUP BY pi.id
        `, [userId]);

        const investments = result.rows;

        // Handle empty portfolio
        if (investments.length === 0) {
            return res.json({
                success: true,
                health: {
                    overallScore: 0,
                    diversityScore: 0,
                    riskScore: 0,
                    liquidityScore: 0
                },
                allocation: {
                    safe: 0,
                    risky: 0,
                    liquid: 0,
                    safePercentage: 0,
                    riskyPercentage: 0,
                    liquidPercentage: 0
                },
                metrics: {
                    totalCategories: 0,
                    totalItems: 0,
                    totalValue: 0,
                    totalInvested: 0
                }
            });
        }

        // Calculate health metrics
        let totalValue = 0;
        let totalInvested = 0;
        let safeValue = 0; // Cases, stickers, etc
        let riskyValue = 0; // Knives, blue gems, etc
        let liquidValue = 0; // High liquidity items
        const itemTypes = new Map();

        for (const inv of investments) {
            const remaining = inv.quantity - inv.sold_quantity;
            if (remaining <= 0) continue;

            const investedValue = inv.purchase_price * remaining;
            totalInvested += investedValue;

            // Get current price
            let currentPrice = inv.purchase_price;
            try {
                const priceData = await postgres.getCachedPrice(inv.item_name);
                currentPrice = priceData?.lowestPrice || inv.purchase_price;

                // Check liquidity
                const listings = priceData?.prices?.csfloat?.listings || 0;
                if (listings > 100) {
                    liquidValue += currentPrice * remaining;
                }
            } catch (e) {
                // Ignore price fetch errors
            }

            const currentValue = currentPrice * remaining;
            totalValue += currentValue;

            // Categorize risk
            const category = categorizeItem(inv.item_name);
            const isSafe = ['Cases', 'Stickers', 'Capsules', 'Keys'].includes(category);
            const isRisky = inv.pattern_tier !== 'Standard' || category === 'Knives';

            if (isSafe) safeValue += currentValue;
            if (isRisky) riskyValue += currentValue;

            // Track item types
            itemTypes.set(category, (itemTypes.get(category) || 0) + 1);
        }

        // Calculate diversity score (1-10)
        const diversityScore = calculateDiversityScore(itemTypes, investments.length);

        // Calculate risk score (1-10, 10 = most risky)
        const riskScore = totalValue > 0 ? (riskyValue / totalValue) * 10 : 5;

        // Calculate liquidity score (1-10)
        const liquidityScore = totalValue > 0 ? (liquidValue / totalValue) * 10 : 5;

        // Overall health score (1-10)
        const healthScore = (
            diversityScore * 0.4 +
            (10 - riskScore) * 0.3 +
            liquidityScore * 0.3
        );

        res.json({
            success: true,
            health: {
                overallScore: parseFloat(healthScore.toFixed(1)),
                diversityScore: parseFloat(diversityScore.toFixed(1)),
                riskScore: parseFloat(riskScore.toFixed(1)),
                liquidityScore: parseFloat(liquidityScore.toFixed(1))
            },
            allocation: {
                safe: parseFloat(safeValue.toFixed(2)),
                risky: parseFloat(riskyValue.toFixed(2)),
                liquid: parseFloat(liquidValue.toFixed(2)),
                safePercentage: totalValue > 0 ? parseFloat(((safeValue / totalValue) * 100).toFixed(2)) : 0,
                riskyPercentage: totalValue > 0 ? parseFloat(((riskyValue / totalValue) * 100).toFixed(2)) : 0,
                liquidPercentage: totalValue > 0 ? parseFloat(((liquidValue / totalValue) * 100).toFixed(2)) : 0
            },
            metrics: {
                totalCategories: itemTypes.size,
                totalItems: investments.length,
                totalValue: parseFloat(totalValue.toFixed(2)),
                totalInvested: parseFloat(totalInvested.toFixed(2))
            }
        });

    } catch (e) {
        winston.error('Error calculating portfolio health:', e);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            code: 'HEALTH_CALCULATION_ERROR'
        });
    }
});

/**
 * Batch Add Investments
 * POST /api/portfolio/batch/add
 */
app.post('/api/portfolio/batch/add', async (req, res) => {
    try {
        const { userId, investments } = req.body;

        if (!userId || !investments || !Array.isArray(investments) || investments.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: userId, investments array',
                code: 'INVALID_REQUEST'
            });
        }

        if (investments.length > 50) {
            return res.status(400).json({
                success: false,
                error: 'Maximum 50 investments per batch',
                code: 'BATCH_LIMIT_EXCEEDED'
            });
        }

        const results = [];
        const errors = [];

        for (const [index, inv] of investments.entries()) {
            try {
                if (!inv.itemName || !inv.purchasePrice) {
                    throw new Error('Missing itemName or purchasePrice');
                }

                const result = await postgres.pool.query(`
                    INSERT INTO portfolio_investments (
                        user_id, item_name, purchase_price, quantity, marketplace, notes
                    )
                    VALUES ($1, $2, $3, $4, $5, $6)
                    RETURNING id
                `, [
                    userId,
                    inv.itemName,
                    inv.purchasePrice,
                    inv.quantity || 1,
                    inv.marketplace || 'Steam',
                    inv.notes || null
                ]);

                results.push({
                    index,
                    id: result.rows[0].id,
                    itemName: inv.itemName,
                    success: true
                });
            } catch (error) {
                errors.push({
                    index,
                    itemName: inv.itemName,
                    error: error.message
                });
            }
        }

        res.json({
            success: true,
            total: investments.length,
            successful: results.length,
            failed: errors.length,
            results: results,
            errors: errors.length > 0 ? errors : undefined
        });

    } catch (e) {
        winston.error('Error in batch add:', e);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            code: 'BATCH_ADD_ERROR'
        });
    }
});

/**
 * Batch Delete Investments
 * POST /api/portfolio/batch/delete
 */
app.post('/api/portfolio/batch/delete', async (req, res) => {
    try {
        const { userId, investmentIds } = req.body;

        if (!userId || !investmentIds || !Array.isArray(investmentIds) || investmentIds.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: userId, investmentIds array',
                code: 'INVALID_REQUEST'
            });
        }

        if (investmentIds.length > 100) {
            return res.status(400).json({
                success: false,
                error: 'Maximum 100 deletions per batch',
                code: 'BATCH_LIMIT_EXCEEDED'
            });
        }

        // Delete all investments
        const result = await postgres.pool.query(`
            DELETE FROM portfolio_investments
            WHERE id = ANY($1) AND user_id = $2
            RETURNING id
        `, [investmentIds, userId]);

        res.json({
            success: true,
            deleted: result.rows.length,
            deletedIds: result.rows.map(r => r.id)
        });

    } catch (e) {
        winston.error('Error in batch delete:', e);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            code: 'BATCH_DELETE_ERROR'
        });
    }
});

/**
 * Get Recent Activity
 * GET /api/portfolio/activity/:userId
 */
app.get('/api/portfolio/activity/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        const limit = parseInt(req.query.limit) || 20;
        const offset = parseInt(req.query.offset) || 0;

        // Get recent investments
        const investmentsResult = await postgres.pool.query(`
            SELECT id, item_name, purchase_price, quantity, marketplace, created_at, 'investment' as type
            FROM portfolio_investments
            WHERE user_id = $1
            ORDER BY created_at DESC
            LIMIT $2 OFFSET $3
        `, [userId, Math.floor(limit / 2), offset]);

        // Get recent sales
        const salesResult = await postgres.pool.query(`
            SELECT ps.id, pi.item_name, ps.sale_price, ps.quantity_sold, ps.marketplace,
                   ps.profit_loss, ps.roi_percent, ps.created_at, 'sale' as type
            FROM portfolio_sales ps
            JOIN portfolio_investments pi ON ps.investment_id = pi.id
            WHERE ps.user_id = $1
            ORDER BY ps.created_at DESC
            LIMIT $2 OFFSET $3
        `, [userId, Math.floor(limit / 2), offset]);

        // Combine and sort by date
        const activities = [...investmentsResult.rows, ...salesResult.rows]
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
            .slice(0, limit);

        res.json({
            success: true,
            activities: activities,
            total: activities.length,
            limit: limit,
            offset: offset
        });

    } catch (e) {
        winston.error('Error fetching activity:', e);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            code: 'ACTIVITY_FETCH_ERROR'
        });
    }
});

/**
 * Export Portfolio
 * GET /api/portfolio/export/:userId
 */
app.get('/api/portfolio/export/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        const format = req.query.format || 'json'; // 'json' or 'csv'

        // Get all portfolio data
        const result = await postgres.pool.query(`
            SELECT
                pi.*,
                COALESCE(SUM(ps.quantity_sold), 0) as sold_quantity,
                COALESCE(SUM(ps.profit_loss), 0) as realized_profit
            FROM portfolio_investments pi
            LEFT JOIN portfolio_sales ps ON pi.id = ps.investment_id
            WHERE pi.user_id = $1
            GROUP BY pi.id
            ORDER BY pi.created_at DESC
        `, [userId]);

        const investments = result.rows;

        if (format === 'csv') {
            // Generate CSV
            const headers = [
                'ID', 'Item Name', 'Purchase Price', 'Quantity', 'Marketplace',
                'Purchase Date', 'Float Value', 'Pattern Index', 'Wear',
                'Investment Score', 'Pattern Tier', 'Notes', 'Is Sold'
            ];

            const csvRows = [headers.join(',')];

            for (const inv of investments) {
                const row = [
                    inv.id,
                    `"${inv.item_name}"`,
                    inv.purchase_price,
                    inv.quantity,
                    inv.marketplace,
                    inv.purchase_date,
                    inv.float_value || '',
                    inv.pattern_index || '',
                    inv.wear || '',
                    inv.investment_score || '',
                    inv.pattern_tier || '',
                    `"${inv.notes || ''}"`,
                    inv.is_sold
                ];
                csvRows.push(row.join(','));
            }

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename=portfolio_${userId}_${Date.now()}.csv`);
            res.send(csvRows.join('\n'));

        } else {
            // JSON format
            res.json({
                success: true,
                exportDate: new Date().toISOString(),
                userId: userId,
                totalInvestments: investments.length,
                investments: investments
            });
        }

    } catch (e) {
        winston.error('Error exporting portfolio:', e);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            code: 'EXPORT_ERROR'
        });
    }
});

/**
 * Update Investment
 * PATCH /api/portfolio/update/:investmentId
 */
app.patch('/api/portfolio/update/:investmentId', async (req, res) => {
    try {
        const investmentId = req.params.investmentId;
        const { purchasePrice, quantity, marketplace, notes, tags } = req.body;

        // Build update query dynamically
        const updates = [];
        const values = [];
        let paramCount = 1;

        if (purchasePrice !== undefined) {
            updates.push(`purchase_price = $${paramCount++}`);
            values.push(purchasePrice);
        }
        if (quantity !== undefined) {
            updates.push(`quantity = $${paramCount++}`);
            values.push(quantity);
        }
        if (marketplace !== undefined) {
            updates.push(`marketplace = $${paramCount++}`);
            values.push(marketplace);
        }
        if (notes !== undefined) {
            updates.push(`notes = $${paramCount++}`);
            values.push(notes);
        }
        if (tags !== undefined) {
            updates.push(`tags = $${paramCount++}`);
            values.push(tags);
        }

        if (updates.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No fields to update',
                code: 'NO_UPDATES'
            });
        }

        updates.push(`updated_at = NOW()`);
        values.push(investmentId);

        const query = `
            UPDATE portfolio_investments
            SET ${updates.join(', ')}
            WHERE id = $${paramCount}
            RETURNING *
        `;

        const result = await postgres.pool.query(query, values);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Investment not found',
                code: 'NOT_FOUND'
            });
        }

        res.json({
            success: true,
            investment: result.rows[0]
        });

    } catch (e) {
        winston.error('Error updating investment:', e);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            code: 'UPDATE_ERROR'
        });
    }
});

// ============================================================================
// HELPER FUNCTIONS FOR ENHANCED FEATURES
// ============================================================================

/**
 * Categorize item by name
 */
function categorizeItem(itemName) {
    const name = itemName.toLowerCase();

    // Knives
    if (itemName.startsWith('★') && !name.includes('glove') && !name.includes('wraps')) {
        return 'Knives';
    }

    // Gloves
    if (itemName.startsWith('★') && (name.includes('glove') || name.includes('wraps'))) {
        return 'Gloves';
    }

    // Cases
    if (name.includes('case') && !name.includes('key')) {
        return 'Cases';
    }

    // Keys
    if (name.includes('key')) {
        return 'Keys';
    }

    // Stickers
    if (name.includes('sticker')) {
        return 'Stickers';
    }

    // Capsules
    if (name.includes('capsule')) {
        return 'Capsules';
    }

    // Agents
    if (name.includes('agent') || name.includes('elite crew') || name.includes('fbi')) {
        return 'Agents';
    }

    // Weapon categories
    if (name.includes('ak-47') || name.includes('m4a4') || name.includes('m4a1-s') ||
        name.includes('galil') || name.includes('famas') || name.includes('sg 553') || name.includes('aug')) {
        return 'Rifles';
    }

    if (name.includes('awp') || name.includes('ssg 08') || name.includes('scar-20') || name.includes('g3sg1')) {
        return 'Snipers';
    }

    if (name.includes('desert eagle') || name.includes('glock-18') || name.includes('usp-s') ||
        name.includes('p250') || name.includes('five-seven') || name.includes('tec-9') ||
        name.includes('cz75') || name.includes('dual berettas') || name.includes('p2000') || name.includes('r8 revolver')) {
        return 'Pistols';
    }

    if (name.includes('mac-10') || name.includes('mp9') || name.includes('mp7') ||
        name.includes('ump-45') || name.includes('p90') || name.includes('pp-bizon') || name.includes('mp5-sd')) {
        return 'SMGs';
    }

    if (name.includes('nova') || name.includes('xm1014') || name.includes('mag-7') ||
        name.includes('sawed-off') || name.includes('m249') || name.includes('negev')) {
        return 'Heavy';
    }

    return 'Other';
}

/**
 * Calculate diversity score (1-10)
 */
function calculateDiversityScore(itemTypes, totalItems) {
    if (totalItems === 0) return 5.0;

    const numCategories = itemTypes.size;

    // Calculate distribution evenness (Gini coefficient approach)
    const values = Array.from(itemTypes.values());
    const maxPossibleCategories = 10; // Theoretical max categories

    // Base score on number of categories
    const categoryScore = Math.min(numCategories / maxPossibleCategories, 1.0) * 10;

    // Penalize if one category dominates
    const maxCount = Math.max(...values);
    const dominanceRatio = maxCount / totalItems;
    const dominancePenalty = dominanceRatio > 0.5 ? (dominanceRatio - 0.5) * 10 : 0;

    const score = Math.max(1, Math.min(10, categoryScore - dominancePenalty));
    return score;
}

winston.info('Portfolio endpoints loaded successfully');

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

// Search items
app.get('/api/items/search', async (req, res) => {
    try {
        const query = req.query.q || req.query.query;
        const limit = parseInt(req.query.limit) || 20;

        if (!query) {
            return res.status(400).json({
                error: 'Missing search query',
                message: 'Provide ?q=query parameter'
            });
        }

        const results = await csgoAPI.searchItems(query, limit);

        res.json({
            success: true,
            query,
            count: results.length,
            results
        });
    } catch (error) {
        winston.error('Item search error:', error);
        res.status(500).json({
            error: 'Failed to search items',
            message: error.message
        });
    }
});

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
// PORTFOLIO SNAPSHOTS & ADVANCED FEATURES
// =====================================================================

// Create portfolio snapshot
app.post('/api/portfolio/snapshot/create/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { granularity = 'daily' } = req.body;

        // Validate granularity
        if (!['hourly', 'daily', 'monthly'].includes(granularity)) {
            return res.status(400).json({
                error: 'Invalid granularity',
                message: 'Must be: hourly, daily, or monthly'
            });
        }

        // Get all investments for user
        const investments = await postgres.pool.query(
            'SELECT * FROM portfolio_investments WHERE user_id = $1 AND is_sold = false',
            [userId]
        );

        if (investments.rows.length === 0) {
            return res.status(404).json({
                error: 'No investments found',
                user_id: userId
            });
        }

        // Calculate portfolio metrics
        let totalValue = 0;
        let totalInvested = 0;
        let assetAllocation = {};

        for (const inv of investments.rows) {
            const invested = parseFloat(inv.purchase_price) * parseInt(inv.quantity);
            totalInvested += invested;

            // Get current price (from price_override or cached price)
            let currentPrice = inv.price_override;
            if (!currentPrice) {
                const cached = await postgres.getCachedPrice(inv.item_name);
                currentPrice = cached?.price || inv.purchase_price;
            }

            const currentValue = parseFloat(currentPrice) * parseInt(inv.quantity);
            totalValue += currentValue;

            // Asset allocation
            const category = inv.tags && inv.tags.length > 0 ? inv.tags[0] : 'Other';
            assetAllocation[category] = (assetAllocation[category] || 0) + currentValue;
        }

        // Get realized profit from sales
        const salesResult = await postgres.pool.query(
            'SELECT COALESCE(SUM(profit_loss), 0) as realized FROM portfolio_sales WHERE user_id = $1',
            [userId]
        );
        const realizedProfit = parseFloat(salesResult.rows[0].realized) || 0;

        // Calculate unrealized profit
        const unrealizedProfit = totalValue - totalInvested;
        const totalRoi = totalInvested > 0 ? ((totalValue - totalInvested + realizedProfit) / totalInvested) * 100 : 0;

        // Determine snapshot date based on granularity
        let snapshotDate = new Date();
        if (granularity === 'hourly') {
            snapshotDate.setMinutes(0, 0, 0);
        } else if (granularity === 'daily') {
            snapshotDate.setHours(0, 0, 0, 0);
        } else if (granularity === 'monthly') {
            snapshotDate.setDate(1);
            snapshotDate.setHours(0, 0, 0, 0);
        }

        // Insert snapshot (will update if exists due to unique constraint)
        const result = await postgres.pool.query(`
            INSERT INTO portfolio_snapshots (
                user_id, snapshot_date, granularity,
                total_value, total_invested, realized_profit, unrealized_profit,
                total_roi, item_count, asset_allocation
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (user_id, snapshot_date, granularity)
            DO UPDATE SET
                total_value = EXCLUDED.total_value,
                total_invested = EXCLUDED.total_invested,
                realized_profit = EXCLUDED.realized_profit,
                unrealized_profit = EXCLUDED.unrealized_profit,
                total_roi = EXCLUDED.total_roi,
                item_count = EXCLUDED.item_count,
                asset_allocation = EXCLUDED.asset_allocation,
                created_at = NOW()
            RETURNING *
        `, [
            userId,
            snapshotDate,
            granularity,
            totalValue.toFixed(2),
            totalInvested.toFixed(2),
            realizedProfit.toFixed(2),
            unrealizedProfit.toFixed(2),
            totalRoi.toFixed(2),
            investments.rows.length,
            JSON.stringify(assetAllocation)
        ]);

        res.json({
            success: true,
            snapshot: result.rows[0]
        });
    } catch (error) {
        winston.error('Snapshot creation error:', error);
        res.status(500).json({
            error: 'Failed to create snapshot',
            message: error.message
        });
    }
});

// Get portfolio snapshot history
app.get('/api/portfolio/snapshot/history/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const granularity = req.query.granularity || 'daily';
        const period = req.query.period || '30d';

        // Parse period (e.g., '7d', '30d', '90d', '1y')
        const match = period.match(/^(\d+)([dmy])$/);
        if (!match) {
            return res.status(400).json({
                error: 'Invalid period format',
                message: 'Use format like: 7d, 30d, 90d, 1y'
            });
        }

        const amount = parseInt(match[1]);
        const unit = match[2];
        const date = new Date();

        if (unit === 'd') {
            date.setDate(date.getDate() - amount);
        } else if (unit === 'm') {
            date.setMonth(date.getMonth() - amount);
        } else if (unit === 'y') {
            date.setFullYear(date.getFullYear() - amount);
        }

        const snapshots = await postgres.pool.query(`
            SELECT * FROM portfolio_snapshots
            WHERE user_id = $1
            AND granularity = $2
            AND snapshot_date >= $3
            ORDER BY snapshot_date DESC
        `, [userId, granularity, date]);

        res.json({
            success: true,
            user_id: userId,
            granularity,
            period,
            count: snapshots.rows.length,
            snapshots: snapshots.rows
        });
    } catch (error) {
        winston.error('Snapshot history error:', error);
        res.status(500).json({
            error: 'Failed to fetch snapshot history',
            message: error.message
        });
    }
});

// Get chart data for portfolio visualization
app.get('/api/portfolio/chart/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const granularity = req.query.granularity || 'daily';
        const days = parseInt(req.query.days) || 30;

        const date = new Date();
        date.setDate(date.getDate() - days);

        const snapshots = await postgres.pool.query(`
            SELECT
                snapshot_date,
                total_value,
                total_invested,
                realized_profit + unrealized_profit as total_profit,
                total_roi
            FROM portfolio_snapshots
            WHERE user_id = $1
            AND granularity = $2
            AND snapshot_date >= $3
            ORDER BY snapshot_date ASC
        `, [userId, granularity, date]);

        // Format for chart libraries
        const chartData = {
            labels: snapshots.rows.map(s => s.snapshot_date.toISOString().split('T')[0]),
            datasets: [
                {
                    label: 'Portfolio Value',
                    data: snapshots.rows.map(s => parseFloat(s.total_value))
                },
                {
                    label: 'Total Invested',
                    data: snapshots.rows.map(s => parseFloat(s.total_invested))
                },
                {
                    label: 'Profit/Loss',
                    data: snapshots.rows.map(s => parseFloat(s.total_profit))
                }
            ]
        };

        res.json({
            success: true,
            user_id: userId,
            granularity,
            days,
            chart_data: chartData
        });
    } catch (error) {
        winston.error('Chart data error:', error);
        res.status(500).json({
            error: 'Failed to fetch chart data',
            message: error.message
        });
    }
});

// Partial sale (sell portion of investment)
app.post('/api/portfolio/sale/partial', async (req, res) => {
    try {
        const {
            investment_id,
            quantity_sold,
            sale_price,
            marketplace,
            notes
        } = req.body;

        if (!investment_id || !quantity_sold || !sale_price) {
            return res.status(400).json({
                error: 'Missing required fields',
                message: 'Required: investment_id, quantity_sold, sale_price'
            });
        }

        // Get investment
        const invResult = await postgres.pool.query(
            'SELECT * FROM portfolio_investments WHERE id = $1',
            [investment_id]
        );

        if (invResult.rows.length === 0) {
            return res.status(404).json({
                error: 'Investment not found',
                investment_id
            });
        }

        const investment = invResult.rows[0];
        const currentQuantity = parseInt(investment.quantity);
        const soldQuantity = parseInt(quantity_sold);

        if (soldQuantity > currentQuantity) {
            return res.status(400).json({
                error: 'Cannot sell more than owned',
                current_quantity: currentQuantity,
                quantity_sold: soldQuantity
            });
        }

        // Calculate profit/loss
        const buyPricePerUnit = parseFloat(investment.purchase_price);
        const salePricePerUnit = parseFloat(sale_price);
        const totalSaleValue = salePricePerUnit * soldQuantity;
        const profitLoss = (salePricePerUnit - buyPricePerUnit) * soldQuantity;
        const roiPercent = buyPricePerUnit > 0 ? (profitLoss / (buyPricePerUnit * soldQuantity)) * 100 : 0;

        // Record sale
        const saleResult = await postgres.pool.query(`
            INSERT INTO portfolio_sales (
                investment_id, user_id, item_name, item_skin_name,
                item_condition, item_variant, quantity_sold,
                buy_price_per_unit, price_per_unit, total_sale_value,
                sale_date, marketplace, profit_loss, roi_percent, notes,
                remaining_quantity, image_url
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), $11, $12, $13, $14, $15, $16)
            RETURNING *
        `, [
            investment_id,
            investment.user_id,
            investment.item_name,
            investment.skin_name,
            investment.wear,
            investment.is_stattrak ? 'stattrak' : 'normal',
            soldQuantity,
            buyPricePerUnit,
            salePricePerUnit,
            totalSaleValue,
            marketplace,
            profitLoss,
            roiPercent,
            notes,
            currentQuantity - soldQuantity,
            investment.image_url
        ]);

        // Update investment quantity
        const remainingQuantity = currentQuantity - soldQuantity;
        if (remainingQuantity === 0) {
            await postgres.pool.query(
                'UPDATE portfolio_investments SET quantity = 0, is_sold = true WHERE id = $1',
                [investment_id]
            );
        } else {
            await postgres.pool.query(
                'UPDATE portfolio_investments SET quantity = $1 WHERE id = $2',
                [remainingQuantity, investment_id]
            );
        }

        res.json({
            success: true,
            sale: saleResult.rows[0],
            remaining_quantity: remainingQuantity,
            fully_sold: remainingQuantity === 0
        });
    } catch (error) {
        winston.error('Partial sale error:', error);
        res.status(500).json({
            error: 'Failed to record sale',
            message: error.message
        });
    }
});

// Get P&L breakdown (realized vs unrealized)
app.get('/api/portfolio/pnl/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const type = req.query.type || 'total'; // realized, unrealized, or total

        // Get realized P&L from sales
        const salesResult = await postgres.pool.query(`
            SELECT
                COALESCE(SUM(profit_loss), 0) as realized_profit,
                COALESCE(SUM(quantity_sold), 0) as total_sold,
                COUNT(*) as sale_count
            FROM portfolio_sales
            WHERE user_id = $1
        `, [userId]);

        const realized = {
            profit: parseFloat(salesResult.rows[0].realized_profit),
            items_sold: parseInt(salesResult.rows[0].total_sold),
            sale_count: parseInt(salesResult.rows[0].sale_count)
        };

        // Get unrealized P&L from current holdings
        const investments = await postgres.pool.query(`
            SELECT * FROM portfolio_investments
            WHERE user_id = $1 AND is_sold = false
        `, [userId]);

        let unrealizedProfit = 0;
        let totalInvested = 0;
        let totalValue = 0;

        for (const inv of investments.rows) {
            const invested = parseFloat(inv.purchase_price) * parseInt(inv.quantity);
            totalInvested += invested;

            let currentPrice = inv.price_override;
            if (!currentPrice) {
                const cached = await postgres.getCachedPrice(inv.item_name);
                currentPrice = cached?.price || inv.purchase_price;
            }

            const currentValue = parseFloat(currentPrice) * parseInt(inv.quantity);
            totalValue += currentValue;
        }

        unrealizedProfit = totalValue - totalInvested;

        const unrealized = {
            profit: unrealizedProfit,
            total_invested: totalInvested,
            current_value: totalValue,
            item_count: investments.rows.length
        };

        const total = {
            profit: realized.profit + unrealized.profit,
            total_return: totalInvested > 0 ? ((realized.profit + unrealized.profit) / totalInvested) * 100 : 0
        };

        let response = {
            success: true,
            user_id: userId
        };

        if (type === 'realized') {
            response.realized = realized;
        } else if (type === 'unrealized') {
            response.unrealized = unrealized;
        } else {
            response = { ...response, realized, unrealized, total };
        }

        res.json(response);
    } catch (error) {
        winston.error('P&L calculation error:', error);
        res.status(500).json({
            error: 'Failed to calculate P&L',
            message: error.message
        });
    }
});

// Price override (manual price for items without market data)
app.patch('/api/portfolio/investment/:investmentId/price-override', async (req, res) => {
    try {
        const { investmentId } = req.params;
        const { price_override } = req.body;

        if (price_override !== null && (isNaN(price_override) || price_override < 0)) {
            return res.status(400).json({
                error: 'Invalid price_override',
                message: 'Must be a positive number or null to remove override'
            });
        }

        const result = await postgres.pool.query(
            'UPDATE portfolio_investments SET price_override = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
            [price_override, investmentId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'Investment not found',
                investment_id: investmentId
            });
        }

        res.json({
            success: true,
            investment: result.rows[0]
        });
    } catch (error) {
        winston.error('Price override error:', error);
        res.status(500).json({
            error: 'Failed to set price override',
            message: error.message
        });
    }
});

// Marketplace override (preferred marketplace per item)
app.patch('/api/portfolio/investment/:investmentId/marketplace-override', async (req, res) => {
    try {
        const { investmentId } = req.params;
        const { marketplace_override } = req.body;

        const validMarkets = ['steam', 'csfloat', 'skinport', 'buff163', 'dmarket', null];
        if (!validMarkets.includes(marketplace_override)) {
            return res.status(400).json({
                error: 'Invalid marketplace',
                message: 'Must be: steam, csfloat, skinport, buff163, dmarket, or null'
            });
        }

        const result = await postgres.pool.query(
            'UPDATE portfolio_investments SET marketplace_override = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
            [marketplace_override, investmentId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'Investment not found',
                investment_id: investmentId
            });
        }

        res.json({
            success: true,
            investment: result.rows[0]
        });
    } catch (error) {
        winston.error('Marketplace override error:', error);
        res.status(500).json({
            error: 'Failed to set marketplace override',
            message: error.message
        });
    }
});

// Get user settings
app.get('/api/user/settings/:userId', async (req, res) => {
    try {
        const { userId } = req.params;

        let result = await postgres.pool.query(
            'SELECT * FROM user_settings WHERE user_id = $1',
            [userId]
        );

        if (result.rows.length === 0) {
            // Create default settings
            result = await postgres.pool.query(`
                INSERT INTO user_settings (user_id) VALUES ($1) RETURNING *
            `, [userId]);
        }

        res.json({
            success: true,
            settings: result.rows[0]
        });
    } catch (error) {
        winston.error('Get settings error:', error);
        res.status(500).json({
            error: 'Failed to fetch settings',
            message: error.message
        });
    }
});

// Update user settings
app.patch('/api/user/settings/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const {
            marketplace_priority,
            timezone,
            currency,
            auto_snapshot,
            snapshot_frequency
        } = req.body;

        // Build update query dynamically
        const updates = [];
        const values = [userId];
        let paramCount = 2;

        if (marketplace_priority) {
            updates.push(`marketplace_priority = $${paramCount++}`);
            values.push(marketplace_priority);
        }
        if (timezone) {
            updates.push(`timezone = $${paramCount++}`);
            values.push(timezone);
        }
        if (currency) {
            updates.push(`currency = $${paramCount++}`);
            values.push(currency);
        }
        if (auto_snapshot !== undefined) {
            updates.push(`auto_snapshot = $${paramCount++}`);
            values.push(auto_snapshot);
        }
        if (snapshot_frequency) {
            updates.push(`snapshot_frequency = $${paramCount++}`);
            values.push(snapshot_frequency);
        }

        if (updates.length === 0) {
            return res.status(400).json({
                error: 'No fields to update'
            });
        }

        updates.push('updated_at = NOW()');

        const query = `
            UPDATE user_settings SET ${updates.join(', ')}
            WHERE user_id = $1
            RETURNING *
        `;

        let result = await postgres.pool.query(query, values);

        if (result.rows.length === 0) {
            // Create if doesn't exist
            result = await postgres.pool.query(`
                INSERT INTO user_settings (user_id, marketplace_priority, timezone, currency, auto_snapshot, snapshot_frequency)
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING *
            `, [
                userId,
                marketplace_priority || ['steam', 'csfloat', 'skinport', 'buff163'],
                timezone || 'UTC',
                currency || 'USD',
                auto_snapshot !== undefined ? auto_snapshot : true,
                snapshot_frequency || 'daily'
            ]);
        }

        res.json({
            success: true,
            settings: result.rows[0]
        });
    } catch (error) {
        winston.error('Update settings error:', error);
        res.status(500).json({
            error: 'Failed to update settings',
            message: error.message
        });
    }
});

winston.info('Portfolio snapshots and advanced features loaded');

// =====================================================================
// AUTHENTICATION & API KEY MANAGEMENT ENDPOINTS
// =====================================================================

const auth = require('./lib/auth');

// Create API key
app.post('/api/auth/create-key', async (req, res) => {
    try {
        const { user_id, key_name, permissions, rate_limit, expires_in_days } = req.body;

        if (!user_id) {
            return res.status(400).json({
                error: 'Missing user_id',
                message: 'Provide user_id in request body'
            });
        }

        const apiKey = auth.generateApiKey();
        const expiresAt = expires_in_days ?
            new Date(Date.now() + expires_in_days * 24 * 60 * 60 * 1000) : null;

        const result = await postgres.pool.query(`
            INSERT INTO api_keys (
                user_id, api_key, key_name, permissions, rate_limit, expires_at
            ) VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id, user_id, api_key, key_name, permissions, rate_limit, is_active, created_at, expires_at
        `, [
            user_id,
            apiKey,
            key_name || 'Default Key',
            permissions || ['read', 'write'],
            rate_limit || 1000,
            expiresAt
        ]);

        res.json({
            success: true,
            message: 'API key created successfully',
            api_key: result.rows[0]
        });
    } catch (error) {
        winston.error('Create API key error:', error);
        res.status(500).json({
            error: 'Failed to create API key',
            message: error.message
        });
    }
});

// List user's API keys
app.get('/api/auth/keys/:userId', async (req, res) => {
    try {
        const { userId } = req.params;

        const result = await postgres.pool.query(`
            SELECT id, user_id, key_name, permissions, rate_limit,
                   is_active, last_used_at, created_at, expires_at,
                   CONCAT(SUBSTRING(api_key, 1, 15), '...') as api_key_preview
            FROM api_keys
            WHERE user_id = $1
            ORDER BY created_at DESC
        `, [userId]);

        res.json({
            success: true,
            count: result.rows.length,
            keys: result.rows
        });
    } catch (error) {
        winston.error('List API keys error:', error);
        res.status(500).json({
            error: 'Failed to list API keys',
            message: error.message
        });
    }
});

// Revoke API key
app.delete('/api/auth/keys/:keyId', async (req, res) => {
    try {
        const { keyId } = req.params;

        const result = await postgres.pool.query(`
            UPDATE api_keys
            SET is_active = false
            WHERE id = $1
            RETURNING id, key_name, is_active
        `, [keyId]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'API key not found'
            });
        }

        res.json({
            success: true,
            message: 'API key revoked',
            key: result.rows[0]
        });
    } catch (error) {
        winston.error('Revoke API key error:', error);
        res.status(500).json({
            error: 'Failed to revoke API key',
            message: error.message
        });
    }
});

winston.info('Authentication endpoints loaded');

// =====================================================================
// DISCORD WEBHOOK ENDPOINTS
// =====================================================================

const discord = require('./lib/discord');

// Configure Discord webhook
app.post('/api/webhooks/discord/configure/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { webhook_url, webhook_name, alert_types } = req.body;

        if (!webhook_url) {
            return res.status(400).json({
                error: 'Missing webhook_url',
                message: 'Provide webhook_url in request body'
            });
        }

        // Test webhook first
        const testResult = await discord.testWebhook(webhook_url);
        if (!testResult.success) {
            return res.status(400).json({
                error: 'Invalid webhook URL',
                message: 'Failed to send test message to Discord webhook'
            });
        }

        const result = await postgres.pool.query(`
            INSERT INTO discord_webhooks (
                user_id, webhook_url, webhook_name, alert_types
            ) VALUES ($1, $2, $3, $4)
            ON CONFLICT (user_id, webhook_url)
            DO UPDATE SET
                webhook_name = EXCLUDED.webhook_name,
                alert_types = EXCLUDED.alert_types,
                enabled = true,
                updated_at = NOW()
            RETURNING *
        `, [
            userId,
            webhook_url,
            webhook_name || 'Default Webhook',
            alert_types || ['price_alert', 'portfolio_milestone', 'snapshot_created']
        ]);

        res.json({
            success: true,
            message: 'Discord webhook configured and tested successfully',
            webhook: result.rows[0]
        });
    } catch (error) {
        winston.error('Configure webhook error:', error);
        res.status(500).json({
            error: 'Failed to configure webhook',
            message: error.message
        });
    }
});

// Test Discord webhook
app.post('/api/webhooks/discord/test/:userId', async (req, res) => {
    try {
        const { userId } = req.params;

        const result = await postgres.pool.query(`
            SELECT webhook_url FROM discord_webhooks
            WHERE user_id = $1 AND enabled = true
            LIMIT 1
        `, [userId]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'No active webhook found',
                message: 'Configure a webhook first'
            });
        }

        const testResult = await discord.testWebhook(result.rows[0].webhook_url);

        res.json({
            success: testResult.success,
            message: testResult.success ?
                'Test message sent successfully' :
                'Failed to send test message',
            error: testResult.error
        });
    } catch (error) {
        winston.error('Test webhook error:', error);
        res.status(500).json({
            error: 'Failed to test webhook',
            message: error.message
        });
    }
});

// Get user's webhooks
app.get('/api/webhooks/discord/:userId', async (req, res) => {
    try {
        const { userId } = req.params;

        const result = await postgres.pool.query(`
            SELECT id, user_id, webhook_name, alert_types, enabled, created_at, updated_at
            FROM discord_webhooks
            WHERE user_id = $1
            ORDER BY created_at DESC
        `, [userId]);

        res.json({
            success: true,
            count: result.rows.length,
            webhooks: result.rows
        });
    } catch (error) {
        winston.error('Get webhooks error:', error);
        res.status(500).json({
            error: 'Failed to get webhooks',
            message: error.message
        });
    }
});

// Delete webhook
app.delete('/api/webhooks/discord/:webhookId', async (req, res) => {
    try {
        const { webhookId } = req.params;

        const result = await postgres.pool.query(`
            DELETE FROM discord_webhooks
            WHERE id = $1
            RETURNING id, webhook_name
        `, [webhookId]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'Webhook not found'
            });
        }

        res.json({
            success: true,
            message: 'Webhook deleted',
            webhook: result.rows[0]
        });
    } catch (error) {
        winston.error('Delete webhook error:', error);
        res.status(500).json({
            error: 'Failed to delete webhook',
            message: error.message
        });
    }
});

winston.info('Discord webhook endpoints loaded');

// =====================================================================
// PRICE ALERT ENDPOINTS
// =====================================================================

// Create price alert
app.post('/api/alerts/create', async (req, res) => {
    try {
        const { user_id, item_name, target_price, condition, marketplace } = req.body;

        if (!user_id || !item_name || !target_price || !condition) {
            return res.status(400).json({
                error: 'Missing required fields',
                message: 'Required: user_id, item_name, target_price, condition'
            });
        }

        if (!['above', 'below'].includes(condition)) {
            return res.status(400).json({
                error: 'Invalid condition',
                message: 'Condition must be "above" or "below"'
            });
        }

        const result = await postgres.pool.query(`
            INSERT INTO price_alerts (
                user_id, item_name, target_price, condition, marketplace
            ) VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `, [user_id, item_name, target_price, condition, marketplace || 'steam']);

        res.json({
            success: true,
            message: 'Price alert created',
            alert: result.rows[0]
        });
    } catch (error) {
        winston.error('Create alert error:', error);
        res.status(500).json({
            error: 'Failed to create alert',
            message: error.message
        });
    }
});

// Get user's price alerts
app.get('/api/alerts/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { active_only = 'true' } = req.query;

        let query = `
            SELECT * FROM price_alerts
            WHERE user_id = $1
        `;

        if (active_only === 'true') {
            query += ' AND is_active = true';
        }

        query += ' ORDER BY created_at DESC';

        const result = await postgres.pool.query(query, [userId]);

        res.json({
            success: true,
            count: result.rows.length,
            alerts: result.rows
        });
    } catch (error) {
        winston.error('Get alerts error:', error);
        res.status(500).json({
            error: 'Failed to get alerts',
            message: error.message
        });
    }
});

// Delete price alert
app.delete('/api/alerts/:alertId', async (req, res) => {
    try {
        const { alertId } = req.params;

        const result = await postgres.pool.query(`
            DELETE FROM price_alerts
            WHERE id = $1
            RETURNING id, item_name, target_price
        `, [alertId]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'Alert not found'
            });
        }

        res.json({
            success: true,
            message: 'Alert deleted',
            alert: result.rows[0]
        });
    } catch (error) {
        winston.error('Delete alert error:', error);
        res.status(500).json({
            error: 'Failed to delete alert',
            message: error.message
        });
    }
});

winston.info('Price alert endpoints loaded');

// =====================================================================
// BATCH PRICE UPDATE ENDPOINTS
// =====================================================================

const csgotrader = require('./lib/csgotrader');

// Trigger price update for all marketplaces
app.post('/api/prices/update-all', async (req, res) => {
    try {
        const { marketplaces } = req.body;

        winston.info('Starting batch price update...');
        const results = await csgotrader.updateAllPrices(postgres, marketplaces);

        res.json({
            success: true,
            message: 'Price update completed',
            ...results
        });
    } catch (error) {
        winston.error('Price update error:', error);
        res.status(500).json({
            error: 'Failed to update prices',
            message: error.message
        });
    }
});

// Get price update status
app.get('/api/prices/update-status', async (req, res) => {
    try {
        const status = await csgotrader.getPriceUpdateStatus(postgres);

        res.json({
            success: true,
            marketplaces: status
        });
    } catch (error) {
        winston.error('Price status error:', error);
        res.status(500).json({
            error: 'Failed to get price status',
            message: error.message
        });
    }
});

// Detect price changes
app.post('/api/prices/detect-changes', async (req, res) => {
    try {
        const { threshold = 5 } = req.body;

        const changes = await csgotrader.detectPriceChanges(postgres, threshold);

        // Send Discord notifications for significant changes
        for (const change of changes.slice(0, 10)) {
            const webhooks = await postgres.pool.query(`
                SELECT webhook_url FROM discord_webhooks
                WHERE enabled = true
                AND 'price_change' = ANY(alert_types)
            `);

            for (const webhook of webhooks.rows) {
                await discord.sendPriceChange(
                    webhook.webhook_url,
                    change.item_name,
                    parseFloat(change.old_price),
                    parseFloat(change.new_price),
                    parseFloat(change.change_percent)
                );
            }
        }

        res.json({
            success: true,
            changes_detected: changes.length,
            significant_changes: changes.slice(0, 20)
        });
    } catch (error) {
        winston.error('Detect changes error:', error);
        res.status(500).json({
            error: 'Failed to detect changes',
            message: error.message
        });
    }
});

// Get price for item from all marketplaces
app.get('/api/prices/multi-market/:itemName', async (req, res) => {
    try {
        const itemName = decodeURIComponent(req.params.itemName);

        const result = await postgres.pool.query(`
            SELECT marketplace, price, last_24h, last_7d, last_30d,
                   starting_at, highest_order, updated_at
            FROM marketplace_prices
            WHERE item_name = $1
            ORDER BY marketplace
        `, [itemName]);

        res.json({
            success: true,
            item_name: itemName,
            count: result.rows.length,
            prices: result.rows
        });
    } catch (error) {
        winston.error('Multi-market price error:', error);
        res.status(500).json({
            error: 'Failed to get prices',
            message: error.message
        });
    }
});

winston.info('Batch price update endpoints loaded');

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

// =====================================================================
// STEAM AUTHENTICATION ROUTES
// =====================================================================
steamAuth.setupAuthRoutes(app, postgres);
winston.info('Steam authentication routes loaded');

// =====================================================================
// STEAM INVENTORY ENDPOINTS
// =====================================================================

// Get user's CS2 inventory
app.get('/api/steam/inventory/:steamId', steamAuth.requireAuth, async (req, res) => {
    try {
        const { steamId } = req.params;
        
        // Verify user can only access their own inventory (unless admin)
        if (req.user.steam_id !== steamId) {
            return res.status(403).json({
                success: false,
                error: 'Forbidden',
                message: 'You can only access your own inventory'
            });
        }
        
        const result = await steamInventory.getSteamInventory(steamId);
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
app.get('/api/steam/inventory/:steamId/value', steamAuth.requireAuth, async (req, res) => {
    try {
        const { steamId } = req.params;
        
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

// Sync inventory to portfolio
app.post('/api/steam/inventory/sync', steamAuth.requireAuth, async (req, res) => {
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
            ? inventoryResult.items.filter(item => selected_items.includes(item.asset_id))
            : inventoryResult.items;
        
        // Add each item to portfolio
        for (const item of itemsToSync) {
            try {
                // Get market price
                let price = 0;
                if (item.marketable && item.market_hash_name) {
                    const cachedPrice = await postgres.getCachedPrice(item.market_hash_name);
                    price = cachedPrice?.price || 0;
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
                    item.name,
                    price,
                    1,
                    'Steam',
                    item.is_stattrak || false,
                    'Imported from Steam inventory'
                ]);
                
                added++;
            } catch (error) {
                errors.push({
                    item: item.name,
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

winston.info('Steam inventory endpoints loaded');


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
