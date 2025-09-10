/**
 * Enhanced background script for CS2 Float Checker Pro
 * Handles API requests, caching, and rate limiting with bulk processing
 * @version 1.6.0
 * @author CS2 Float Checker Team
 */

/**
 * Configuration constants for API rate limiting and bulk processing
 */
const API_CONFIG = {
    BASE_URL: 'https://api.cs2floatchecker.com',
    BULK_DELAY: 2000,       // 2 second delay before processing bulk requests (faster collection)
    BULK_SIZE: 10,          // Increased batch size to 10 items per request for better efficiency
    MIN_BULK_SIZE: 3,       // Minimum items to trigger bulk request
    MAX_REQUESTS_PER_SECOND: 2,  // Allow 2 requests per second for better performance
    REQUEST_WINDOW: 1000,        // 1 second window for rate limiting
    MAX_RETRIES: 3,             // Maximum retry attempts
    BASE_DELAY: 1500,           // Reduced base delay for faster retries
    GLOBAL_REQUEST_DELAY: 800,  // Reduced global delay for better performance
    INDIVIDUAL_REQUEST_DELAY: 1200, // Separate delay for individual requests
    USER_AGENT: 'CS2FloatChecker/1.6.0'
};

/**
 * Bulk request queue for efficient API usage
 * @type {Array<{inspectLink: string, sendResponse: Function, timestamp: number, priority: string}>}
 */
let bulkQueue = [];

/**
 * Priority queue for urgent requests that should bypass bulk processing
 * @type {Array<{inspectLink: string, sendResponse: Function, timestamp: number}>}
 */
let priorityQueue = [];

/**
 * Timer ID for bulk request processing
 * @type {number|null}
 */
let bulkTimer = null;

/**
 * Timer ID for priority queue processing
 * @type {number|null}
 */
let priorityTimer = null;

/**
 * Rate limiting state variables
 */
let lastRequestTime = 0;
let requestCount = 0;
let requestQueue = [];
let isProcessingQueue = false;

/**
 * Checks if a new API request can be made based on rate limiting rules
 * @returns {boolean} True if request can be made, false otherwise
 */
function canMakeRequest() {
    const now = Date.now();
    
    // Check if enough time has passed since last request (global delay)
    if (now - lastRequestTime < API_CONFIG.GLOBAL_REQUEST_DELAY) {
        return false;
    }
    
    // Reset counter if more than 1 second has passed
    if (now - lastRequestTime > API_CONFIG.REQUEST_WINDOW) {
        requestCount = 0;
        lastRequestTime = now;
    }
    
    return requestCount < API_CONFIG.MAX_REQUESTS_PER_SECOND;
}

/**
 * Records that a request has been made for rate limiting purposes
 */
function recordRequest() {
    requestCount++;
    lastRequestTime = Date.now();
}

/**
 * Makes an API request with retry logic and exponential backoff
 * @param {string} url - The URL to fetch from
 * @param {number} retryCount - Current retry count (default: 0)
 * @returns {Promise<{success: boolean, data?: any, error?: string}>} Response object
 */
async function makeApiRequestWithRetry(url, retryCount = 0) {
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'User-Agent': API_CONFIG.USER_AGENT
            }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            return { success: true, data };
        } else if (response.status === 429 && retryCount < API_CONFIG.MAX_RETRIES) {
            // Rate limited, apply exponential backoff
            const delay = API_CONFIG.BASE_DELAY * Math.pow(2, retryCount);
            console.log(`Rate limited, retrying in ${delay}ms (attempt ${retryCount + 1}/${API_CONFIG.MAX_RETRIES})`);
            
            await new Promise(resolve => setTimeout(resolve, delay));
            return makeApiRequestWithRetry(url, retryCount + 1);
        } else {
            return { success: false, error: data.error || `API returned status ${response.status}` };
        }
    } catch (error) {
        if (retryCount < API_CONFIG.MAX_RETRIES) {
            const delay = API_CONFIG.BASE_DELAY * Math.pow(2, retryCount);
            console.log(`Network error, retrying in ${delay}ms (attempt ${retryCount + 1}/${API_CONFIG.MAX_RETRIES}):`, error.message);
            
            await new Promise(resolve => setTimeout(resolve, delay));
            return makeApiRequestWithRetry(url, retryCount + 1);
        } else {
            return { success: false, error: error.message };
        }
    }
}

/**
 * Makes a bulk API request for multiple inspect links
 * @param {string[]} links - Array of Steam inspect links
 * @returns {Promise<{success: boolean, data?: any, error?: string}>} Response object
 */
async function makeBulkApiRequest(links) {
    // Ensure we respect global rate limiting for bulk requests too
    if (!canMakeRequest()) {
        console.log('Rate limit exceeded for bulk request, waiting...');
        await new Promise(resolve => setTimeout(resolve, API_CONFIG.GLOBAL_REQUEST_DELAY));
    }
    
    recordRequest(); // Record the bulk request
    
    try {
        const response = await fetch(`${API_CONFIG.BASE_URL}/bulk`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'User-Agent': API_CONFIG.USER_AGENT
            },
            body: JSON.stringify({
                links: links.map(link => ({ link }))
            })
    });

    const data = await response.json();

    if (response.ok) {
      return { success: true, data };
    } else {
      return { success: false, error: data.error || `API returned status ${response.status}` };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Adds a request to the appropriate queue based on priority
 * @param {string} inspectLink - Steam inspect link
 * @param {Function} sendResponse - Callback function for the response
 * @param {boolean} isPriority - Whether this is a priority request
 */
function addToQueue(inspectLink, sendResponse, isPriority = false) {
    if (isPriority) {
        console.log('Adding priority request to fast queue');
        priorityQueue.push({ inspectLink, sendResponse, timestamp: Date.now() });
        
        // Process priority requests immediately with minimal delay
        if (!priorityTimer) {
            priorityTimer = setTimeout(processPriorityQueue, 100);
        }
        return;
    }
    
    // Regular bulk queue processing
    addToBulkQueue(inspectLink, sendResponse);
}

/**
 * Processes priority queue for urgent requests
 * @returns {Promise<void>}
 */
async function processPriorityQueue() {
    if (priorityQueue.length === 0) {
        priorityTimer = null;
        return;
    }
    
    const request = priorityQueue.shift();
    console.log('Processing priority request');
    
    // Process immediately as individual request
    await processSingleRequest(request.inspectLink, request.sendResponse);
    
    // Continue processing if more priority requests exist
    if (priorityQueue.length > 0) {
        priorityTimer = setTimeout(processPriorityQueue, 500); // Small delay between priority requests
    } else {
        priorityTimer = null;
    }
}

/**
 * Adds a request to the bulk processing queue with intelligent processing
 * @param {string} inspectLink - Steam inspect link
 * @param {Function} sendResponse - Callback function for the response
 */
function addToBulkQueue(inspectLink, sendResponse) {
    bulkQueue.push({ inspectLink, sendResponse, timestamp: Date.now() });
    
    // If we have enough items for an efficient bulk request, process immediately
    if (bulkQueue.length >= API_CONFIG.BULK_SIZE) {
        console.log(`Bulk queue full (${bulkQueue.length}), processing immediately`);
        if (bulkTimer) {
            clearTimeout(bulkTimer);
            bulkTimer = null;
        }
        processBulkQueue();
        return;
    }
    
    // Start bulk timer if not already running
    if (!bulkTimer) {
        bulkTimer = setTimeout(() => {
            // Only process as bulk if we have minimum required items
            if (bulkQueue.length >= API_CONFIG.MIN_BULK_SIZE) {
                processBulkQueue();
            } else {
                // Process individual requests if bulk size not met
                console.log(`Only ${bulkQueue.length} items in queue, processing individually`);
                processQueueIndividually();
            }
        }, API_CONFIG.BULK_DELAY);
    }
}

/**
 * Processes individual requests when bulk size threshold not met
 * @returns {Promise<void>}
 */
async function processQueueIndividually() {
    console.log(`Processing ${bulkQueue.length} individual requests`);
    
    const requests = bulkQueue.splice(0); // Take all remaining requests
    bulkTimer = null;
    
    // Process each request individually with appropriate delays
    for (let i = 0; i < requests.length; i++) {
        const item = requests[i];
        // Stagger requests to respect rate limits
        setTimeout(() => {
            processSingleRequest(item.inspectLink, item.sendResponse);
        }, i * API_CONFIG.INDIVIDUAL_REQUEST_DELAY);
    }
}

/**
 * Processes the bulk request queue in batches
 * @returns {Promise<void>}
 */
async function processBulkQueue() {
    if (bulkQueue.length === 0) {
        bulkTimer = null;
        return;
    }

    const batch = bulkQueue.splice(0, API_CONFIG.BULK_SIZE);
    console.log(`Processing bulk request with ${batch.length} items`);

    const links = batch.map(item => item.inspectLink);
    const result = await makeBulkApiRequest(links);

    if (result.success) {
        // Process each item in the bulk response
        const responseKeys = Object.keys(result.data);
        let successfulItems = 0;
        
        for (let i = 0; i < batch.length; i++) {
            const item = batch[i];
            const itemKey = responseKeys[i];
            const itemData = result.data[itemKey];

            if (itemData && !itemData.error) {
                // Cache the successful response (wrap in iteminfo for consistency)
                await cacheFloatData(item.inspectLink, { iteminfo: itemData });
                
                // Send response to the original requester
                item.sendResponse({ iteminfo: itemData });
                successfulItems++;
            } else {
                // Handle individual item errors
                item.sendResponse({ error: itemData?.error || 'Item not found in bulk response' });
            }
        }
        
        // Update stats with fractional API call count for bulk efficiency
        const apiCallFraction = 1 / batch.length; // Each item in bulk counts as partial API call
        await updateStats({ apiCalls: apiCallFraction * successfulItems, itemsChecked: successfulItems });
        
        console.log(`Bulk request completed: ${successfulItems}/${batch.length} items successful`);
        
    } else {
        // Handle bulk request failure - fall back to individual requests with staggered delays
        console.log('Bulk request failed, falling back to individual requests:', result.error);
        for (let i = 0; i < batch.length; i++) {
            const item = batch[i];
            // Stagger individual requests to avoid overwhelming API
            setTimeout(() => {
                processSingleRequest(item.inspectLink, item.sendResponse);
            }, i * API_CONFIG.INDIVIDUAL_REQUEST_DELAY);
        }
    }

    // Continue processing if there are more items in queue
    if (bulkQueue.length > 0) {
        // Use shorter delay for continuing bulk processing
        bulkTimer = setTimeout(processBulkQueue, API_CONFIG.BULK_DELAY / 2);
    } else {
        bulkTimer = null;
    }
}

/**
 * Processes a single request (fallback from bulk processing)
 * @param {string} inspectLink - Steam inspect link
 * @param {Function} sendResponse - Callback function for the response
 * @returns {Promise<void>}
 */
async function processSingleRequest(inspectLink, sendResponse) {
    try {
        // Check cache first
        const cacheKey = inspectLink;
        const cachedData = await getCachedFloatData(cacheKey);
        if (cachedData) {
            console.log('Returning cached float data');
            await updateStats({ cacheHits: 1 });
            sendResponse(cachedData);
            return;
        }

        // Check rate limit and wait if necessary
        if (!canMakeRequest()) {
            const waitTime = API_CONFIG.INDIVIDUAL_REQUEST_DELAY - (Date.now() - lastRequestTime);
            console.log(`Rate limit exceeded, waiting ${waitTime}ms before individual request`);
            if (waitTime > 0) {
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
            
            // Check again after waiting
            if (!canMakeRequest()) {
                console.log('Still rate limited after waiting, rejecting request');
                sendResponse({ error: 'Rate limit exceeded, please try again later' });
                return;
            }
        }

        // Use single API request with retry logic
        const apiUrl = `${API_CONFIG.BASE_URL}/?url=${encodeURIComponent(inspectLink)}`;
        console.log('Fetching from API (individual):', apiUrl);

        recordRequest();
        const result = await makeApiRequestWithRetry(apiUrl);

        if (result.success) {
            console.log('API response received:', result.data);
            await cacheFloatData(cacheKey, result.data);
            await updateStats({ apiCalls: 1, itemsChecked: 1 });
            sendResponse(result.data);
        } else {
            console.error('API error:', result.error);
            sendResponse({ error: result.error });
        }
    } catch (error) {
        console.error('Background fetch error:', error);
        sendResponse({ error: error.message });
    }
}

/**
 * Extension installation/update handler
 * Sets up default settings, uninstall URL, and welcome page
 */
chrome.runtime.onInstalled.addListener((details) => {
    console.log('CS2 Float Checker Pro installed/updated');
    
    // Set uninstall URL for feedback collection
    chrome.runtime.setUninstallURL('https://cs2floatchecker.com/uninstall?source=extension');
    
    // Open welcome page on install (not on update)
    if (details.reason === 'install') {
        chrome.tabs.create({
            url: 'https://cs2floatchecker.com/welcome?source=extension&version=1.6.0'
        });
    }
  
  // Set enhanced default settings
  chrome.storage.local.set({
    settings: {
      enableMarket: true,
      enableInventory: true,
      autoLoad: true,
      showStickers: true,
      showKeychains: true,
      highlightLowFloat: true,
      highlightHighFloat: true,
      highlightOwned: true,
      showPaintSeed: true,
      showFloatRank: true,
      enableFloatFilters: true,
      enableCaching: true,
      cacheExpiry: 24, // hours
      showTooltips: true,
      floatPrecision: 0,
      language: 'en'
    },
    stats: {
      itemsChecked: 0,
      cacheHits: 0,
      apiCalls: 0,
      extensionVersion: '1.6.0',
      installDate: new Date().toISOString()
    },
    features: {
      inventory: true,
      market: true,
      notifications: true
    }
  });
});

/**
 * Message handler for communication with content scripts and popup
 * Handles stats updates, float data fetching, and other extension commands
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'updateStats') {
        chrome.storage.local.get(['stats'], (result) => {
            const stats = result.stats || { itemsChecked: 0 };
            stats.itemsChecked += request.increment || 1;
            chrome.storage.local.set({ stats });
        });
        sendResponse({ success: true });
    }
  
  // Handle float data fetching with caching and CORS bypass
  if (request.action === 'fetchFloat') {
    (async () => {
      try {
        console.log('Fetching float for:', request.inspectLink);
        
        // Basic validation of inspect link
        if (!request.inspectLink) {
          console.error('No inspect link provided');
          sendResponse({ error: 'No inspect link provided' });
          return;
        }
        
        // Check cache first (24-hour expiration like competitor)
        const cacheKey = request.inspectLink;
        const cachedData = await getCachedFloatData(cacheKey);
        if (cachedData) {
          console.log('Returning cached float data');
          // Update cache hit stats
          await updateStats({ cacheHits: 1 });
          sendResponse(cachedData);
          return;
        }
        
        // Determine if this should be a priority request
        // Priority requests: single item hover/inspect, user-triggered actions
        const isPriority = request.priority === 'high' || request.immediate === true;
        
        // Add to appropriate queue for processing
        console.log(`Adding request to ${isPriority ? 'priority' : 'bulk'} queue`);
        addToQueue(request.inspectLink, sendResponse, isPriority);
        
      } catch (error) {
        console.error('Background fetch error:', error);
        sendResponse({ error: error.message });
      }
    })();
    return true; // Keep message channel open for async response
  }
  
  return true;
});

/**
 * Retrieves cached float data for an inspect link
 * @param {string} inspectLink - Steam inspect link
 * @returns {Promise<any|null>} Cached data or null if not found/expired
 */
async function getCachedFloatData(inspectLink) {
    try {
        const result = await chrome.storage.local.get([`float_${inspectLink}`, 'settings']);
        const cached = result[`float_${inspectLink}`];
        const settings = result.settings || { cacheExpiry: 24 };
        
        if (cached) {
            const now = Date.now();
            const cacheTime = new Date(cached.timestamp).getTime();
            const hoursDiff = (now - cacheTime) / (1000 * 60 * 60);
            
            // Use user's cache expiry setting
            if (hoursDiff < settings.cacheExpiry) {
                console.log(`Cache hit for ${inspectLink.substring(0, 50)}... (${hoursDiff.toFixed(1)}h old)`);
                return cached.data;
            } else {
                console.log(`Cache expired for ${inspectLink.substring(0, 50)}... (${hoursDiff.toFixed(1)}h old)`);
                // Clean up expired cache
                chrome.storage.local.remove([`float_${inspectLink}`]);
            }
        }
        
        return null;
    } catch (error) {
        console.error('Cache read error:', error);
        return null;
    }
}

/**
 * Caches float data for an inspect link
 * @param {string} inspectLink - Steam inspect link
 * @param {any} data - Float data to cache
 * @returns {Promise<void>}
 */
async function cacheFloatData(inspectLink, data) {
    try {
        const cacheEntry = {
            data: data,
            timestamp: new Date().toISOString(),
            version: '1.6.0' // Track cache version for future migrations
        };
        
        await chrome.storage.local.set({
            [`float_${inspectLink}`]: cacheEntry
        });
        
        console.log(`Cached float data for ${inspectLink.substring(0, 50)}...`);
        
        // Implement cache size management (keep only 1000 most recent)
        await manageCacheSize();
        
    } catch (error) {
        console.error('Cache write error:', error);
    }
}

/**
 * Manages cache size by removing old entries when cache exceeds limit
 * @returns {Promise<void>}
 */
async function manageCacheSize() {
    try {
        const result = await chrome.storage.local.get(null);
        const floatCaches = Object.entries(result).filter(([key]) => key.startsWith('float_'));
        
        if (floatCaches.length > 1000) {
            // Sort by timestamp and keep only 800 most recent (leave room for new ones)
            floatCaches.sort((a, b) => new Date(b[1].timestamp) - new Date(a[1].timestamp));
            
            const toRemove = floatCaches.slice(800).map(([key]) => key);
            await chrome.storage.local.remove(toRemove);
            
            console.log(`Cache cleanup: removed ${toRemove.length} old entries`);
        }
    } catch (error) {
        console.error('Cache management error:', error);
    }
}

/**
 * Updates extension usage statistics
 * @param {Object} increments - Object containing stat increments
 * @param {number} [increments.itemsChecked] - Number of items checked
 * @param {number} [increments.cacheHits] - Number of cache hits
 * @param {number} [increments.apiCalls] - Number of API calls made
 * @returns {Promise<void>}
 */
async function updateStats(increments) {
    try {
        const result = await chrome.storage.local.get(['stats']);
        const currentStats = result.stats || {
            itemsChecked: 0,
            cacheHits: 0,
            apiCalls: 0,
            extensionVersion: '1.6.0',
            installDate: new Date().toISOString()
        };
        
        // Update incremental stats
        Object.keys(increments).forEach(key => {
            currentStats[key] = (currentStats[key] || 0) + increments[key];
        });
        
        // Add last activity timestamp
        currentStats.lastActivity = new Date().toISOString();
        
        await chrome.storage.local.set({ stats: currentStats });
        
    } catch (error) {
        console.error('Stats update error:', error);
    }
}