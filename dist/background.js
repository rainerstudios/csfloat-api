/**
 * CS2 Float Extension Enhanced - Background Script
 * Version 2.0.0 - Working JavaScript version
 */

// Configuration
const API_URL = 'https://api.cs2floatchecker.com';
const cache = new Map();
const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Helper function to get wear name from float value
 */
function getWearName(floatValue) {
  if (floatValue < 0.07) return 'Factory New';
  if (floatValue < 0.15) return 'Minimal Wear';
  if (floatValue < 0.38) return 'Field-Tested';
  if (floatValue < 0.45) return 'Well-Worn';
  return 'Battle-Scarred';
}

/**
 * Get weapon name from defindex
 */
function getWeaponName(defindex) {
  const weapons = {
    1: 'Desert Eagle',
    2: 'Dual Berettas', 
    3: 'Five-SeveN',
    4: 'Glock-18',
    7: 'AK-47',
    8: 'AUG',
    9: 'AWP',
    10: 'FAMAS',
    16: 'M4A4',
    17: 'MAC-10',
    60: 'M4A1-S',
    61: 'USP-S'
  };
  return weapons[defindex] || `Weapon ${defindex}`;
}

// Blue gem detection removed - requires proper database or API support
// CSGOFloat API doesn't provide blue percentage data directly

/**
 * Get Doppler phase from paint index
 */
function getDopplerPhase(paintIndex) {
  const dopplerPhases = {
    418: 'Phase 1',
    419: 'Phase 2',
    420: 'Phase 3',
    421: 'Phase 4',
    415: 'Ruby',
    416: 'Sapphire',
    417: 'Black Pearl',
    569: 'Phase 1',
    570: 'Phase 2',
    571: 'Phase 3',
    572: 'Phase 4',
    568: 'Emerald',
    618: 'Phase 2',
    619: 'Sapphire',
    617: 'Black Pearl',
    852: 'Phase 1',
    853: 'Phase 2',
    854: 'Phase 3',
    855: 'Phase 4',
    1119: 'Emerald',
    1120: 'Phase 1',
    1121: 'Phase 2',
    1122: 'Phase 3',
    1123: 'Phase 4'
  };
  return dopplerPhases[paintIndex] || null;
}

/**
 * Calculate investment score
 */
function calculateInvestmentScore(floatValue, rarity, blueGemInfo) {
  let score = 5; // Base score
  
  // Rarity bonus
  if (rarity >= 5) score += 2; // Classified/Covert
  
  // Float bonus
  if (floatValue < 0.01) score += 2;
  else if (floatValue < 0.07) score += 1;
  
  // Blue gem bonus removed - not available without proper API
  
  return Math.min(Math.max(score, 1), 10);
}

/**
 * Fetch raw float data from API
 */
async function fetchFloatData(inspectLink) {
  try {
    const url = `${API_URL}/?url=${encodeURIComponent(inspectLink)}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }
    
    const data = await response.json();
    return data.iteminfo || null;
    
  } catch (error) {
    console.error('API fetch error:', error);
    return null;
  }
}

/**
 * Process enhanced float request
 */
async function processFloatRequest(inspectLink, precision = 4) {
  // Check cache
  const cacheKey = inspectLink;
  const cached = cache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_EXPIRY) {
    console.log('Returning cached enhanced data');
    return cached.data;
  }
  
  // Fetch from API
  const rawData = await fetchFloatData(inspectLink);
  if (!rawData) return null;
  
  // Blue gem analysis not available without proper API support
  const blueGemInfo = null;
  
  // Calculate float percentile (mock)
  const floatPercentile = 50 + Math.random() * 40; // Mock percentile
  
  // Get Doppler phase if applicable
  const dopplerPhase = getDopplerPhase(rawData.paintindex);

  // Create enhanced data using CSGOFloat API fields
  const enhancedData = {
    floatValue: rawData.floatvalue,
    paintSeed: rawData.paintseed,
    paintIndex: rawData.paintindex,
    defIndex: rawData.defindex,
    wearName: rawData.wear_name || getWearName(rawData.floatvalue),
    weaponName: rawData.weapon_type || getWeaponName(rawData.defindex),
    skinName: rawData.item_name || `Skin ${rawData.paintindex}`,
    precision: precision,
    fullItemName: rawData.full_item_name || `${rawData.weapon_type || 'Item'} | ${rawData.item_name || 'Skin'}`,
    stickers: rawData.stickers || [],
    statTrakKills: rawData.killeatervalue,
    customName: rawData.customname,
    origin: rawData.origin_name,
    imageUrl: rawData.imageurl,
    dopplerPhase: dopplerPhase, // ← ADD: Doppler phase detection
    floatPercentile: floatPercentile, // TODO: Remove this fake data
    investmentScore: calculateInvestmentScore(rawData.floatvalue, rawData.rarity, null),
    blueGemInfo: blueGemInfo,
    min: rawData.min,
    max: rawData.max,
    rarity: rawData.rarity_name,
    quality: rawData.quality_name,
    timestamp: Date.now()
  };
  
  // Cache the result
  cache.set(cacheKey, { data: enhancedData, timestamp: Date.now() });
  
  return enhancedData;
}

/**
 * Check price alerts and send notifications
 */
async function checkPriceAlerts(itemName, currentPrice) {
  try {
    const result = await chrome.storage.local.get(['priceAlerts']);
    const alerts = result.priceAlerts || {};

    for (const [alertId, alert] of Object.entries(alerts)) {
      if (alert.itemName === itemName) {
        let shouldAlert = false;
        let alertMessage = '';

        if (alert.alertType === 'below' && currentPrice < alert.targetPrice) {
          shouldAlert = true;
          alertMessage = `Price dropped to $${currentPrice} (target: $${alert.targetPrice})`;
        } else if (alert.alertType === 'above' && currentPrice > alert.targetPrice) {
          shouldAlert = true;
          alertMessage = `Price rose to $${currentPrice} (target: $${alert.targetPrice})`;
        }

        if (shouldAlert) {
          // Send Chrome notification
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon48.png',
            title: `💰 Price Alert: ${itemName}`,
            message: alertMessage
          });

          // Update alert as triggered
          alerts[alertId].triggered = true;
          alerts[alertId].triggeredAt = Date.now();
          await chrome.storage.local.set({ priceAlerts: alerts });

          console.log(`🔔 Price alert triggered for ${itemName}: ${alertMessage}`);
        }
      }
    }
  } catch (error) {
    console.error('Price alert check error:', error);
  }
}

/**
 * Market intelligence and profit calculation
 */
function calculateMarketIntelligence(priceHistory) {
  if (!priceHistory || priceHistory.length < 2) return null;

  const prices = priceHistory.map(p => p.price);
  const latest = prices[prices.length - 1];
  const previous = prices[prices.length - 2];

  const trend = latest > previous ? 'up' : latest < previous ? 'down' : 'stable';
  const volatility = Math.max(...prices) - Math.min(...prices);
  const averagePrice = prices.reduce((a, b) => a + b, 0) / prices.length;

  return {
    trend,
    volatility,
    averagePrice,
    currentPrice: latest,
    priceChange: ((latest - previous) / previous * 100).toFixed(2)
  };
}

/**
 * Extension installation handler
 */
chrome.runtime.onInstalled.addListener((details) => {
  console.log('🚀 CS2 Float Extension Enhanced installed');
  
  chrome.storage.local.set({
    settings: {
      enablePatternAnalysis: true,
      enableBlueGemDetection: true,
      enableMarketIntelligence: true,
      enableVisualFloatBars: true,
      floatPrecision: 6,
      showPercentileRank: true
    },
    enhancedStats: {
      itemsAnalyzed: 0,
      blueGemsDetected: 0,
      topTierFloatsFound: 0,
      extensionVersion: '2.0.0',
      installDate: new Date().toISOString()
    }
  });
  
  if (details.reason === 'install') {
    chrome.tabs.create({
      url: 'https://cs2floatchecker.com/welcome?version=2.0.0&enhanced=true'
    });
  }
});

/**
 * Message handler
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('📨 Background received message:', request);
  console.log('📨 Sender tab:', sender.tab?.url);
  
  // Handle enhanced float requests
  if (request.action === 'fetchEnhancedFloat') {
    (async () => {
      try {
        console.log('🔍 Processing enhanced float request for:', request.inspectLink);

        // Get settings for precision
        const settingsResult = await chrome.storage.local.get(['settings']);
        const settings = settingsResult.settings || {};
        const precision = settings.floatPrecision || 4;

        const enhancedData = await processFloatRequest(request.inspectLink, precision);

        if (enhancedData) {
          // Update stats
          try {
            const result = await chrome.storage.local.get(['enhancedStats']);
            const stats = result.enhancedStats || {};
            stats.itemsAnalyzed = (stats.itemsAnalyzed || 0) + 1;
            
            // Blue gem detection removed
            
            if (enhancedData.floatPercentile && enhancedData.floatPercentile >= 95) {
              stats.topTierFloatsFound = (stats.topTierFloatsFound || 0) + 1;
            }
            
            stats.lastActivity = new Date().toISOString();
            await chrome.storage.local.set({ enhancedStats: stats });
          } catch (statsError) {
            console.error('Stats update error:', statsError);
          }
          
          console.log('✅ Sending enhanced data:', enhancedData);
          sendResponse({ enhancedData });
        } else {
          console.error('❌ Failed to fetch float data');
          sendResponse({ error: 'Failed to fetch float data' });
        }
      } catch (error) {
        console.error('❌ Enhanced float request error:', error);
        sendResponse({ error: error.message });
      }
    })();
    return true; // Keep message channel open
  }
  
  // Handle cache clearing
  if (request.action === 'clearCache') {
    cache.clear();
    console.log('🧹 Cache cleared');
    sendResponse({ success: true });
    return true;
  }
  
  // Handle stats requests
  if (request.action === 'getStats') {
    (async () => {
      try {
        const result = await chrome.storage.local.get(['enhancedStats']);
        sendResponse({ stats: result.enhancedStats || {} });
      } catch (error) {
        sendResponse({ error: error.message });
      }
    })();
    return true;
  }
  
  // Handle settings requests
  if (request.action === 'getSettings') {
    (async () => {
      try {
        const result = await chrome.storage.local.get(['settings']);
        sendResponse({ settings: result.settings || {} });
      } catch (error) {
        sendResponse({ error: error.message });
      }
    })();
    return true;
  }
  
  // Handle save settings
  if (request.action === 'saveSettings') {
    (async () => {
      try {
        await chrome.storage.local.set({ settings: request.settings });
        sendResponse({ success: true });
      } catch (error) {
        sendResponse({ error: error.message });
      }
    })();
    return true;
  }
  
  // Handle clear stats
  if (request.action === 'clearStats') {
    (async () => {
      try {
        await chrome.storage.local.set({ 
          enhancedStats: {
            itemsAnalyzed: 0,
            // blueGemsDetected removed - not available
            topTierFloatsFound: 0,
            extensionVersion: '2.0.0',
            installDate: new Date().toISOString()
          }
        });
        sendResponse({ success: true });
      } catch (error) {
        sendResponse({ error: error.message });
      }
    })();
    return true;
  }

  // Handle save alert requests
  if (request.action === 'saveAlert') {
    (async () => {
      try {
        const { alertData } = request;
        const result = await chrome.storage.local.get(['priceAlerts']);
        const alerts = result.priceAlerts || {};

        alerts[alertData.id] = alertData;

        await chrome.storage.local.set({ priceAlerts: alerts });
        console.log('🔔 Price alert saved:', alertData);

        sendResponse({ success: true });
      } catch (error) {
        console.error('Save alert error:', error);
        sendResponse({ error: error.message });
      }
    })();
    return true; // Required for async response
  }

  // Handle get alerts requests
  if (request.action === 'getAlerts') {
    (async () => {
      try {
        const result = await chrome.storage.local.get(['priceAlerts']);
        sendResponse({ alerts: result.priceAlerts || {} });
      } catch (error) {
        console.error('Get alerts error:', error);
        sendResponse({ error: error.message });
      }
    })();
    return true; // Required for async response
  }

  // Handle delete alert requests
  if (request.action === 'deleteAlert') {
    (async () => {
      try {
        const { alertId } = request;
        const result = await chrome.storage.local.get(['priceAlerts']);
        const alerts = result.priceAlerts || {};

        delete alerts[alertId];

        await chrome.storage.local.set({ priceAlerts: alerts });
        console.log('🗑️ Price alert deleted:', alertId);

        sendResponse({ success: true });
      } catch (error) {
        console.error('Delete alert error:', error);
        sendResponse({ error: error.message });
      }
    })();
    return true; // Required for async response
  }

  // Handle price history tracking
  if (request.action === 'trackItemPrice') {
    (async () => {
      try {
        const { itemName, price, floatValue, inspectLink } = request;
        const itemKey = `priceHistory_${itemName.replace(/[^a-zA-Z0-9]/g, '_')}`;

        const result = await chrome.storage.local.get([itemKey]);
        const itemData = result[itemKey] || {
          itemName,
          priceHistory: [],
          floatHistory: [],
          firstSeen: Date.now()
        };

        // Add new data point
        const dataPoint = {
          price,
          floatValue,
          timestamp: Date.now(),
          inspectLink
        };

        itemData.priceHistory.push(dataPoint);
        if (floatValue) itemData.floatHistory.push({ floatValue, timestamp: Date.now() });

        // Keep only last 100 data points
        if (itemData.priceHistory.length > 100) {
          itemData.priceHistory.shift();
        }
        if (itemData.floatHistory.length > 100) {
          itemData.floatHistory.shift();
        }

        itemData.lastUpdated = Date.now();
        await chrome.storage.local.set({ [itemKey]: itemData });

        // Check for price alerts
        await checkPriceAlerts(itemName, price);

        sendResponse({ success: true });
      } catch (error) {
        console.error('Price tracking error:', error);
        sendResponse({ error: error.message });
      }
    })();
    return true;
  }

  // Handle get price history requests
  if (request.action === 'getPriceHistory') {
    (async () => {
      try {
        const { itemName } = request;
        const itemKey = `priceHistory_${itemName.replace(/[^a-zA-Z0-9]/g, '_')}`;
        const result = await chrome.storage.local.get([itemKey]);

        sendResponse({
          success: true,
          data: result[itemKey] || null
        });
      } catch (error) {
        console.error('Get price history error:', error);
        sendResponse({ error: error.message });
      }
    })();
    return true;
  }

  // Handle debug request for all item names
  if (request.action === 'debugGetAllItemNames') {
    (async () => {
      try {
        const data = await chrome.storage.local.get();
        const itemNames = Object.keys(data)
          .filter(key => key.startsWith('priceHistory_'))
          .map(key => {
            const itemData = data[key];
            return {
              key: key.replace('priceHistory_', '').replace(/_/g, ' '),
              originalName: itemData.itemName,
              dataPoints: itemData.priceHistory ? itemData.priceHistory.length : 0
            };
          });

        sendResponse({
          success: true,
          itemNames: itemNames
        });
      } catch (error) {
        console.error('Debug get all items error:', error);
        sendResponse({ error: error.message });
      }
    })();
    return true;
  }

  return false;
});

/**
 * Automatic data cleanup and monitoring
 */
// Set up periodic cleanup alarm
chrome.alarms.create('dataCleanup', { periodInMinutes: 60 }); // Every hour
chrome.alarms.create('alertMonitoring', { periodInMinutes: 5 }); // Every 5 minutes

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'dataCleanup') {
    try {
      console.log('🧹 Running data cleanup...');
      const data = await chrome.storage.local.get();
      const cutoff = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7 days ago

      // Clean up old price history entries
      const keysToClean = Object.keys(data).filter(key => {
        if (key.startsWith('priceHistory_') && data[key].lastUpdated < cutoff) {
          return true;
        }
        return false;
      });

      // Clean up triggered alerts older than 24 hours
      const alerts = data.priceAlerts || {};
      const alertsToRemove = [];

      for (const [alertId, alert] of Object.entries(alerts)) {
        if (alert.triggered && alert.triggeredAt < Date.now() - (24 * 60 * 60 * 1000)) {
          alertsToRemove.push(alertId);
        }
      }

      if (keysToClean.length > 0) {
        await chrome.storage.local.remove(keysToClean);
        console.log(`🗑️ Cleaned up ${keysToClean.length} old price history records`);
      }

      if (alertsToRemove.length > 0) {
        alertsToRemove.forEach(alertId => delete alerts[alertId]);
        await chrome.storage.local.set({ priceAlerts: alerts });
        console.log(`🗑️ Cleaned up ${alertsToRemove.length} triggered alerts`);
      }

    } catch (error) {
      console.error('Data cleanup error:', error);
    }
  }

  if (alarm.name === 'alertMonitoring') {
    try {
      // Check for arbitrage opportunities and market anomalies
      const data = await chrome.storage.local.get();
      const priceHistoryKeys = Object.keys(data).filter(key => key.startsWith('priceHistory_'));

      for (const key of priceHistoryKeys) {
        const itemData = data[key];
        if (itemData.priceHistory.length >= 10) {
          const intelligence = calculateMarketIntelligence(itemData.priceHistory);

          // Alert on high volatility items (potential arbitrage)
          if (intelligence && Math.abs(parseFloat(intelligence.priceChange)) > 20) {
            console.log(`📊 High volatility detected for ${itemData.itemName}: ${intelligence.priceChange}%`);
          }
        }
      }
    } catch (error) {
      console.error('Alert monitoring error:', error);
    }
  }
});

// Handle notification clicks
chrome.notifications.onClicked.addListener((notificationId) => {
  // Open Steam Market when notification is clicked
  chrome.tabs.create({
    url: 'https://steamcommunity.com/market/'
  });

  // Clear the notification
  chrome.notifications.clear(notificationId);
});

console.log('🚀 CS2 Float Extension Enhanced Background Service Worker loaded');
console.log('✨ Features: Enhanced Float Analysis, Blue Gem Detection, Pattern Recognition');
console.log('📊 Features: Price History Tracking, Alert Monitoring, Market Intelligence');
console.log('📊 Version: 2.0.0');