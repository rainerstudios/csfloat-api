// Enhanced background script for CS2 Float Checker Pro

// Bulk request queue for efficient API usage
let bulkQueue = [];
let bulkTimer = null;
const BULK_DELAY = 2000; // 2 second delay before processing bulk requests
const BULK_SIZE = 10; // Maximum items per bulk request

// Enhanced rate limiting with exponential backoff to prevent "too many pending requests"
let lastRequestTime = 0;
let requestCount = 0;
let requestQueue = [];
let isProcessingQueue = false;
const MAX_REQUESTS_PER_SECOND = 2; // Reduced to be more conservative
const REQUEST_WINDOW = 1000; // 1 second
const MAX_RETRIES = 3;
const BASE_DELAY = 1000; // 1 second base delay for exponential backoff

function canMakeRequest() {
  const now = Date.now();
  
  // Reset counter if more than 1 second has passed
  if (now - lastRequestTime > REQUEST_WINDOW) {
    requestCount = 0;
    lastRequestTime = now;
  }
  
  return requestCount < MAX_REQUESTS_PER_SECOND;
}

function recordRequest() {
  requestCount++;
  lastRequestTime = Date.now();
}

// Enhanced request with retry logic and exponential backoff
async function makeApiRequestWithRetry(url, retryCount = 0) {
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'CS2FloatChecker/1.6.0'
      }
    });
    
    const data = await response.json();
    
    if (response.ok) {
      return { success: true, data };
    } else if (response.status === 429 && retryCount < MAX_RETRIES) {
      // Rate limited, apply exponential backoff
      const delay = BASE_DELAY * Math.pow(2, retryCount);
      console.log(`Rate limited, retrying in ${delay}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
      return makeApiRequestWithRetry(url, retryCount + 1);
    } else {
      return { success: false, error: data.error || `API returned status ${response.status}` };
    }
  } catch (error) {
    if (retryCount < MAX_RETRIES) {
      const delay = BASE_DELAY * Math.pow(2, retryCount);
      console.log(`Network error, retrying in ${delay}ms (attempt ${retryCount + 1}/${MAX_RETRIES}):`, error.message);
      
      await new Promise(resolve => setTimeout(resolve, delay));
      return makeApiRequestWithRetry(url, retryCount + 1);
    } else {
      return { success: false, error: error.message };
    }
  }
}

// Bulk API request function
async function makeBulkApiRequest(links) {
  try {
    const response = await fetch('https://api.cs2floatchecker.com/bulk', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'CS2FloatChecker/1.6.0'
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

// Add request to bulk queue
function addToBulkQueue(inspectLink, sendResponse) {
  bulkQueue.push({ inspectLink, sendResponse });
  
  // Start bulk timer if not already running
  if (!bulkTimer) {
    bulkTimer = setTimeout(processBulkQueue, BULK_DELAY);
  }
}

// Process bulk queue
async function processBulkQueue() {
  if (bulkQueue.length === 0) {
    bulkTimer = null;
    return;
  }

  const batch = bulkQueue.splice(0, BULK_SIZE);
  console.log(`Processing bulk request with ${batch.length} items`);

  const links = batch.map(item => item.inspectLink);
  const result = await makeBulkApiRequest(links);

  if (result.success) {
    // Process each item in the bulk response
    const responseKeys = Object.keys(result.data);
    for (let i = 0; i < batch.length; i++) {
      const item = batch[i];
      const itemKey = responseKeys[i];
      const itemData = result.data[itemKey];

      if (itemData && !itemData.error) {
        // Cache the successful response (wrap in iteminfo for consistency)
        await cacheFloatData(item.inspectLink, { iteminfo: itemData });
        
        // Update stats
        await updateStats({ apiCalls: 0.1, itemsChecked: 1 }); // Fractional API call since it's bulk
        
        // Send response to the original requester
        item.sendResponse({ iteminfo: itemData });
      } else {
        // Handle individual item errors
        item.sendResponse({ error: itemData?.error || 'Item not found in bulk response' });
      }
    }
  } else {
    // Handle bulk request failure - fall back to individual requests
    console.log('Bulk request failed, falling back to individual requests:', result.error);
    for (const item of batch) {
      // Add back to individual processing
      processSingleRequest(item.inspectLink, item.sendResponse);
    }
  }

  // Continue processing if there are more items in queue
  if (bulkQueue.length > 0) {
    bulkTimer = setTimeout(processBulkQueue, BULK_DELAY);
  } else {
    bulkTimer = null;
  }
}

// Process single request (fallback from bulk)
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

    // Check rate limit
    if (!canMakeRequest()) {
      console.log('Rate limit exceeded, delaying request');
      sendResponse({ error: 'Rate limit exceeded, please try again in a moment' });
      return;
    }

    // Use single API request with retry logic
    const apiUrl = `https://api.cs2floatchecker.com/?url=${encodeURIComponent(inspectLink)}`;
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

// Handle messages from content scripts and popup
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
        
        // Add to bulk queue for efficient processing
        // This reduces API load and improves performance
        console.log('Adding request to bulk queue');
        addToBulkQueue(request.inspectLink, sendResponse);
        
      } catch (error) {
        console.error('Background fetch error:', error);
        sendResponse({ error: error.message });
      }
    })();
    return true; // Keep message channel open for async response
  }
  
  return true;
});

// Advanced caching system - better than competitor's localStorage approach
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

async function cacheFloatData(inspectLink, data) {
  try {
    const cacheEntry = {
      data: data,
      timestamp: new Date().toISOString(),
      version: '1.5.1' // Track cache version for future migrations
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

// Enhanced statistics tracking
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