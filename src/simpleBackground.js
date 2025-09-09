// Enhanced background script for CS2 Float Checker Pro
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
      lowFloatThreshold: 0.07,
      highFloatThreshold: 0.93,
      showPaintSeed: true,
      showFloatRank: true,
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
        
        // Use production API (following CSFloat's approach)
        try {
          const apiUrl = `https://api.cs2floatchecker.com/?url=${encodeURIComponent(request.inspectLink)}`;
          console.log('Fetching from API:', apiUrl);
          
          const response = await fetch(apiUrl);
          const data = await response.json();
          
          if (response.ok) {
            console.log('API response received:', data);
            
            // Cache the successful response
            await cacheFloatData(cacheKey, data);
            
            // Update API call stats
            await updateStats({ apiCalls: 1, itemsChecked: 1 });
            
            sendResponse(data);
          } else {
            // CSFloat style error handling - throw the API's error message
            console.error('API error:', data.error || `HTTP ${response.status}`);
            sendResponse({ error: data.error || `API returned status ${response.status}` });
          }
        } catch (error) {
          console.error('Network error:', error.message);
          sendResponse({ error: error.message });
        }
        
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