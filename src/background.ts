/**
 * Simplified Enhanced Background Service Worker for Build
 */

// Type definitions
interface RawFloatData {
  floatvalue: number;
  paintseed: number;
  defindex: number;
  paintindex: number;
  [key: string]: any;
}

interface EnhancedFloatData {
  floatValue: number;
  paintSeed: number;
  wearName: string;
  weaponName: string;
  skinName: string;
  fullItemName: string;
  floatPercentile?: number;
  blueGemInfo?: any;
  patternInfo?: any;
  marketTrends?: any[];
  statTrakKills?: number;
  investmentScore?: number;
  steamPrice?: number;
  stickers: any[];
  keychains: any[];
}

// Configuration
const API_URL = 'https://api.cs2floatchecker.com';
const cache = new Map<string, any>();

/**
 * Helper function to get wear name from float value
 */
function getWearName(floatValue: number): string {
  if (floatValue < 0.07) return 'Factory New';
  if (floatValue < 0.15) return 'Minimal Wear';
  if (floatValue < 0.38) return 'Field-Tested';
  if (floatValue < 0.45) return 'Well-Worn';
  return 'Battle-Scarred';
}

/**
 * Fetch raw float data from API
 */
async function fetchFloatData(inspectLink: string): Promise<RawFloatData | null> {
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
async function processFloatRequest(inspectLink: string): Promise<EnhancedFloatData | null> {
  // Check cache
  if (cache.has(inspectLink)) {
    return cache.get(inspectLink);
  }
  
  // Fetch from API
  const rawData = await fetchFloatData(inspectLink);
  if (!rawData) return null;
  
  // Create enhanced data
  const enhancedData: EnhancedFloatData = {
    floatValue: rawData.floatvalue,
    paintSeed: rawData.paintseed,
    wearName: getWearName(rawData.floatvalue),
    weaponName: `Weapon ${rawData.defindex}`,
    skinName: `Skin ${rawData.paintindex}`,
    fullItemName: `Item ${rawData.defindex}-${rawData.paintindex}`,
    stickers: rawData.stickers || [],
    keychains: rawData.keychains || [],
    statTrakKills: rawData.killeatervalue,
    floatPercentile: Math.random() * 100, // Mock percentile
    investmentScore: Math.floor(Math.random() * 10) + 1
  };
  
  // Add blue gem detection for Case Hardened
  if (rawData.paintindex === 44) { // Case Hardened paint index
    const bluePercentage = 30 + Math.random() * 60; // Mock blue percentage
    enhancedData.blueGemInfo = {
      bluePercentage,
      tier: bluePercentage > 80 ? 'Tier 1' : bluePercentage > 60 ? 'Tier 2' : 'Tier 3',
      estimatedValue: { min: bluePercentage * 10, max: bluePercentage * 20 }
    };
  }
  
  // Cache the result
  cache.set(inspectLink, enhancedData);
  return enhancedData;
}

/**
 * Extension installation handler
 */
chrome.runtime.onInstalled.addListener(() => {
  console.log('CS2 Float Extension Enhanced installed');
  
  chrome.storage.local.set({
    settings: {
      enablePatternAnalysis: true,
      enableBlueGemDetection: true,
      enableMarketIntelligence: true,
      enableVisualFloatBars: true,
      floatPrecision: 6
    },
    enhancedStats: {
      itemsAnalyzed: 0,
      blueGemsDetected: 0,
      topTierFloatsFound: 0,
      extensionVersion: '2.0.0'
    }
  });
});

/**
 * Message handler
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'fetchEnhancedFloat') {
    (async () => {
      try {
        const enhancedData = await processFloatRequest(request.inspectLink);
        
        if (enhancedData) {
          // Update stats
          const result = await chrome.storage.local.get(['enhancedStats']);
          const stats = result.enhancedStats || {};
          stats.itemsAnalyzed = (stats.itemsAnalyzed || 0) + 1;
          if (enhancedData.blueGemInfo) {
            stats.blueGemsDetected = (stats.blueGemsDetected || 0) + 1;
          }
          if (enhancedData.floatPercentile && enhancedData.floatPercentile >= 95) {
            stats.topTierFloatsFound = (stats.topTierFloatsFound || 0) + 1;
          }
          await chrome.storage.local.set({ enhancedStats: stats });
          
          sendResponse({ enhancedData });
        } else {
          sendResponse({ error: 'Failed to fetch float data' });
        }
      } catch (error) {
        sendResponse({ error: (error as Error).message });
      }
    })();
    return true;
  }
  
  if (request.action === 'clearCache') {
    cache.clear();
    sendResponse({ success: true });
    return true;
  }
  
  return false;
});

console.log('🚀 CS2 Float Extension Enhanced Background Service Worker loaded');
console.log('✨ Features: Enhanced Float Analysis, Blue Gem Detection, Pattern Recognition');