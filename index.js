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
            res.header('Access-Control-Allow-Methods', 'GET');
        }
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

// Buff163 Price Proxy (CORS bypass)
app.get('/api/buff163-proxy', async (req, res) => {
    try {
        const { search } = req.query;

        if (!search) {
            return res.status(400).json({ error: 'Missing search parameter' });
        }

        // Note: Buff163 API requires authentication and proper headers
        // This is a simplified proxy - you'll need to add your own Buff163 API credentials
        const buffApiUrl = `https://buff.163.com/api/market/goods`;
        const params = new URLSearchParams({
            game: 'csgo',
            page_num: 1,
            sort_by: 'price.asc',
            search: search
        });

        const response = await fetch(`${buffApiUrl}?${params.toString()}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json',
                'Accept-Language': 'en-US,en;q=0.9'
            }
        });

        if (!response.ok) {
            winston.warn(`Buff163 API returned status ${response.status}`);
            // Return mock data if API fails
            return res.json({
                success: false,
                message: 'Buff163 API unavailable - showing mock data'
            });
        }

        const data = await response.json();

        // Transform Buff163 response to our format
        const transformedData = {
            success: true,
            items: data.data?.items?.map(item => ({
                id: item.id,
                market_hash_name: item.market_hash_name,
                sell_min_price: item.sell_min_price,
                sell_num: item.sell_num
            })) || []
        };

        res.json(transformedData);

    } catch (e) {
        winston.error('Error proxying Buff163 request:', e);
        // Return mock data on error
        res.json({
            success: false,
            message: 'Buff163 proxy error - using fallback data'
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
    const tradeDate = new Date(latestTrade.created_at);
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
