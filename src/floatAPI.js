class FloatAPI {
  constructor() {
    this.cache = new Map();
    this.pendingRequests = new Map();
  }

  async getItemFloat(inspectLink) {
    if (this.cache.has(inspectLink)) {
      return this.cache.get(inspectLink);
    }

    if (this.pendingRequests.has(inspectLink)) {
      return this.pendingRequests.get(inspectLink);
    }

    const promise = this.fetchFloat(inspectLink);
    this.pendingRequests.set(inspectLink, promise);

    try {
      const result = await promise;
      this.cache.set(inspectLink, result);
      this.pendingRequests.delete(inspectLink);
      return result;
    } catch (error) {
      this.pendingRequests.delete(inspectLink);
      throw error;
    }
  }

  async fetchFloat(inspectLink) {
    if (!this.validateInspectUrl(inspectLink)) {
      throw new Error('Invalid inspect URL format');
    }

    try {
      const params = new URLSearchParams({ url: inspectLink });
      const response = await fetch(`https://api.cs2floatchecker.com/?${params}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'CS2FLOAT-Extension/1.0.0'
        },
        timeout: 10000
      });
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`API request failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      
      const floatValue = data.iteminfo?.floatvalue;
      const wear = this.getWearName(floatValue);
      const wearRange = this.getWearRange(wear);
      const floatRank = this.getFloatPercentage(floatValue, data.iteminfo?.min || 0, data.iteminfo?.max || 1);
      
      return {
        floatValue: floatValue,
        paintSeed: data.iteminfo?.paintseed,
        paintIndex: data.iteminfo?.paintindex,
        pattern: data.iteminfo?.paintseed,
        defIndex: data.iteminfo?.defindex,
        origin: data.iteminfo?.origin,
        quality: data.iteminfo?.quality,
        rarity: data.iteminfo?.rarity,
        stickers: data.iteminfo?.stickers || [],
        min: data.iteminfo?.min || 0,
        max: data.iteminfo?.max || 1,
        // Map weapon names from defindex
        weaponType: this.getWeaponName(data.iteminfo?.defindex),
        itemName: this.getSkinName(data.iteminfo?.paintindex),
        rarityName: this.getRarityName(data.iteminfo?.rarity),
        qualityName: this.getQualityName(data.iteminfo?.quality),
        originName: this.getOriginName(data.iteminfo?.origin),
        wear: wear,
        wearRange: wearRange,
        floatRank: floatRank.toFixed(2),
        lowFloat: floatValue < 0.07,
        highFloat: floatValue > 0.93,
        isStatTrak: data.iteminfo?.quality === 9 || data.iteminfo?.killeatervalue !== undefined,
        statTrakKills: data.iteminfo?.killeatervalue,
        isSouvenir: data.iteminfo?.quality === 12,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('Error fetching float:', error);
      return null;
    }
  }

  getWearName(floatValue) {
    if (floatValue < 0.07) return 'Factory New';
    if (floatValue < 0.15) return 'Minimal Wear';
    if (floatValue < 0.37) return 'Field-Tested';
    if (floatValue < 0.44) return 'Well-Worn';
    return 'Battle-Scarred';
  }
  
  getWearRange(wear) {
    const ranges = {
      'Factory New': [0.00, 0.07],
      'Minimal Wear': [0.07, 0.15],
      'Field-Tested': [0.15, 0.37],
      'Well-Worn': [0.37, 0.44],
      'Battle-Scarred': [0.44, 1.00]
    };
    return ranges[wear] || [0, 1];
  }
  
  getFloatPercentage(floatValue, min = 0, max = 1) {
    return ((floatValue - min) / (max - min)) * 100;
  }
  
  extractInspectLink(element) {
    if (typeof element === 'string') {
      return this.parseInspectUrl(element);
    }
    
    const href = element?.href || element?.getAttribute?.('href') || '';
    const onclick = element?.onclick?.toString() || element?.getAttribute?.('onclick') || '';
    const dataInspect = element?.getAttribute?.('data-inspect') || '';
    const combined = `${href} ${onclick} ${dataInspect}`;
    
    return this.parseInspectUrl(combined);
  }

  parseInspectUrl(input) {
    if (!input || typeof input !== 'string') return null;
    
    try {
      // Decode URI to handle encoded characters
      const decoded = decodeURI(input);
      
      // Enhanced regex pattern based on CSGO-API-Inspect
      const match = decoded.match(/^steam:\/\/rungame\/730\/\d+\/[+ ]csgo_econ_action_preview ([SM])(\d+)A(\d+)D(\d+)$/);
      
      if (match) {
        const [fullMatch, type, id, a, d] = match;
        
        // Validate all numeric parts
        if (!/^\d+$/.test(id) || !/^\d+$/.test(a) || !/^\d+$/.test(d)) {
          return null;
        }
        
        // Reconstruct the URL in standard format
        if (type === 'S') {
          return `steam://rungame/730/76561202255233023/+csgo_econ_action_preview S${id}A${a}D${d}`;
        } else if (type === 'M') {
          return `steam://rungame/730/76561202255233023/+csgo_econ_action_preview M${id}A${a}D${d}`;
        }
      }
      
      // Fallback: Match any steam inspect URL
      const fallbackMatch = input.match(/steam:\/\/rungame\/730\/[^'"\\s]+/);
      if (fallbackMatch && this.validateInspectUrl(fallbackMatch[0])) {
        return fallbackMatch[0];
      }
    } catch (e) {
      console.debug('URL parsing failed:', e);
    }
    
    return null;
  }

  validateInspectUrl(url) {
    if (!url || typeof url !== 'string') return false;
    
    try {
      // Must start with steam://rungame/730/
      if (!url.startsWith('steam://rungame/730/')) return false;
      
      // Decode URI to handle encoded characters
      const decoded = decodeURI(url);
      
      // Extract parameters using enhanced regex
      const match = decoded.match(/[+ ]csgo_econ_action_preview ([SM])(\d+)A(\d+)D(\d+)$/);
      if (!match) return false;
      
      const [, type, id, a, d] = match;
      
      // Validate type is S or M
      if (type !== 'S' && type !== 'M') return false;
      
      // Validate all parameters are numeric and not empty
      return [id, a, d].every(param => param && /^\d+$/.test(param) && param !== '0');
      
    } catch (e) {
      return false;
    }
  }

  // Extract parameters from inspect URL
  extractUrlParams(url) {
    if (!this.validateInspectUrl(url)) return null;
    
    try {
      const decoded = decodeURI(url);
      const match = decoded.match(/csgo_econ_action_preview ([SM])(\d+)A(\d+)D(\d+)$/);
      
      if (match) {
        const [, type, id, a, d] = match;
        return {
          type,
          s: type === 'S' ? id : '0',
          m: type === 'M' ? id : '0',
          a,
          d,
          isMarket: type === 'M'
        };
      }
    } catch (e) {
      console.debug('Parameter extraction failed:', e);
    }
    
    return null;
  }
  
  getOriginName(origin) {
    const origins = {
      0: 'Timed Drop',
      1: 'Achievement',
      2: 'Purchased',
      3: 'Traded',
      4: 'Crafted',
      5: 'Store Promotion',
      6: 'Gifted',
      7: 'Support Granted',
      8: 'Found in Crate',
      9: 'Earned',
      10: 'Third-Party Site',
      11: 'Halloween Drop',
      12: 'Steam Purchase',
      14: 'Market',
      15: 'Quest Reward',
      16: 'Level Up Reward'
    };
    return origins[origin] || `Origin ${origin}`;
  }
  
  calculateFloatRanking(floatValue, itemData) {
    const totalRange = (itemData.max || 1) - (itemData.min || 0);
    const relativePosition = (floatValue - (itemData.min || 0)) / totalRange;
    const ranking = relativePosition * 100;
    
    return {
      percentage: ranking.toFixed(2),
      ranking: ranking < 1 ? 'Top 1%' : ranking < 5 ? 'Top 5%' : ranking < 10 ? 'Top 10%' : `${ranking.toFixed(0)}%`,
      isGoodFloat: ranking < 10
    };
  }

  async getBatchFloats(inspectLinks) {
    const promises = inspectLinks.map(link => this.getItemFloat(link));
    return Promise.allSettled(promises);
  }

  clearCache() {
    this.cache.clear();
  }

  getCacheSize() {
    return this.cache.size;
  }

  // Utility methods inspired by CSFloat implementation
  filterKeys(obj, keys) {
    if (!obj || typeof obj !== 'object') return {};
    return keys.reduce((filtered, key) => {
      if (obj.hasOwnProperty(key)) filtered[key] = obj[key];
      return filtered;
    }, {});
  }

  removeNullValues(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    return Object.entries(obj).reduce((clean, [key, value]) => {
      if (value !== null && value !== undefined) clean[key] = value;
      return clean;
    }, {});
  }

  chunkArray(array, size) {
    if (!Array.isArray(array) || size <= 0) return [];
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  isValidNumber(value) {
    return typeof value === 'number' && !isNaN(value) && isFinite(value);
  }

  safeParseFloat(value, defaultValue = 0) {
    const parsed = parseFloat(value);
    return this.isValidNumber(parsed) ? parsed : defaultValue;
  }

  // Enhanced batch processing with chunking
  async getBatchFloatsChunked(inspectLinks, chunkSize = 3) {
    const chunks = this.chunkArray(inspectLinks, chunkSize);
    const results = [];
    
    for (const chunk of chunks) {
      const chunkResults = await this.getBatchFloats(chunk);
      results.push(...chunkResults);
      
      // Small delay between chunks to respect rate limits
      if (chunks.indexOf(chunk) < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    return results;
  }

  // Helper functions to map numeric IDs to names
  getWeaponName(defindex) {
    const weapons = {
      1: 'Desert Eagle',
      2: 'Dual Berettas',
      3: 'Five-SeveN',
      4: 'Glock-18',
      7: 'AK-47',
      8: 'AUG',
      9: 'AWP',
      10: 'FAMAS',
      11: 'G3SG1',
      13: 'Galil AR',
      14: 'M249',
      16: 'M4A4',
      17: 'MAC-10',
      19: 'P90',
      20: 'Zone 9mm',
      23: 'MP5-SD',
      24: 'UMP-45',
      25: 'XM1014',
      26: 'PP-Bizon',
      27: 'MAG-7',
      28: 'Negev',
      29: 'Sawed-Off',
      30: 'Tec-9',
      31: 'Zeus x27',
      32: 'P2000',
      33: 'MP7',
      34: 'MP9',
      35: 'Nova',
      36: 'P250',
      38: 'SCAR-20',
      39: 'SG 553',
      40: 'SSG 08',
      60: 'M4A1-S',
      61: 'USP-S',
      63: 'CZ75-Auto',
      64: 'R8 Revolver'
    };
    return weapons[defindex] || `Weapon ${defindex}`;
  }

  getSkinName(paintindex) {
    const skins = {
      282: 'Redline',
      12: 'Safari Mesh',
      38: 'Fade',
      43: 'Case Hardened',
      44: 'Asiimov',
      179: 'Dragon Lore',
      344: 'Howl'
      // Add more as needed
    };
    return skins[paintindex] || `Skin ${paintindex}`;
  }

  getRarityName(rarity) {
    const rarities = {
      1: 'Consumer Grade',
      2: 'Industrial Grade', 
      3: 'Mil-Spec',
      4: 'Restricted',
      5: 'Classified',
      6: 'Covert'
    };
    return rarities[rarity] || `Rarity ${rarity}`;
  }

  getQualityName(quality) {
    const qualities = {
      0: 'Normal',
      1: 'Genuine',
      3: 'Vintage',
      5: 'Unusual',
      6: 'Unique',
      7: 'Community',
      8: 'Valve',
      9: 'StatTrak',
      11: 'Strange',
      12: 'Souvenir'
    };
    return qualities[quality] || `Quality ${quality}`;
  }
}

window.FloatAPI = FloatAPI;