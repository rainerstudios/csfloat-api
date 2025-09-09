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
      lowFloatThreshold: 0.07,
      highFloatThreshold: 0.93,
      showPaintSeed: true,
      showFloatRank: true,
      enableCaching: true,
      cacheExpiry: 24, // hours
      showTooltips: true,
      floatPrecision: 4,
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
        
        // Add delay to prevent rate limiting
        const delay = Math.random() * 2000 + 1000; // Random delay 1-3 seconds
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Use production API as primary endpoint
        const apiUrl = `https://api.cs2floatchecker.com/?url=${encodeURIComponent(request.inspectLink)}`;
        console.log('Using production API:', apiUrl);
        
        const response = await fetch(apiUrl, {
          method: 'GET',
          headers: {
            'User-Agent': 'CS2FloatChecker/1.6.0',
            'Accept': 'application/json'
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log('API response received:', data);
          
          // Cache the successful response
          await cacheFloatData(cacheKey, data);
          
          // Update API call stats
          await updateStats({ apiCalls: 1, itemsChecked: 1 });
          
          sendResponse(data);
        } else {
          console.error('API response not ok:', response.status);
          if (response.status === 400) {
            console.log('Rate limited, will retry this item later');
          }
          sendResponse(null);
        }
      } catch (error) {
        console.error('Background fetch error:', error);
        sendResponse(null);
      }
    })();
    return true; // Keep message channel open for async response
  }
  
  return true;
});

// Advanced caching system - better than competitor's localStorage approach
async function getCachedFloatData(inspectLink) {
  try {
    const result = await chrome.storage.local.get([`float_${inspectLink}`]);
    const cached = result[`float_${inspectLink}`];
    
    if (cached) {
      const now = Date.now();
      const cacheTime = new Date(cached.timestamp).getTime();
      const hoursDiff = (now - cacheTime) / (1000 * 60 * 60);
      
      // 24-hour cache expiration (same as competitor)
      if (hoursDiff < 24) {
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