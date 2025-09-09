export class CacheManager {
  static get(key) {
    try {
      const cached = JSON.parse(localStorage.getItem(key) || '{}');
      const item = cached[key];
      
      if (!item) return null;
      
      const now = new Date();
      const cachedTime = new Date(item.timestamp);
      
      chrome.storage.local.get(['settings'], (result) => {
        const settings = result.settings || { cacheExpiry: 24 };
        const expiryTime = settings.cacheExpiry * 60 * 60 * 1000;
        
        if (now.getTime() - cachedTime.getTime() < expiryTime) {
          return item.data;
        }
        
        delete cached[key];
        localStorage.setItem(key, JSON.stringify(cached));
        return null;
      });
      
      return item.data;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  static set(key, data) {
    try {
      const cached = JSON.parse(localStorage.getItem(key) || '{}');
      cached[key] = {
        data,
        timestamp: new Date().toISOString()
      };
      localStorage.setItem(key, JSON.stringify(cached));
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  static clear(key) {
    try {
      const cached = JSON.parse(localStorage.getItem(key) || '{}');
      delete cached[key];
      localStorage.setItem(key, JSON.stringify(cached));
    } catch (error) {
      console.error('Cache clear error:', error);
    }
  }

  static clearAll(storageKey) {
    try {
      localStorage.removeItem(storageKey);
    } catch (error) {
      console.error('Cache clear all error:', error);
    }
  }
}

export class FeatureManager {
  static getFeatures() {
    try {
      return JSON.parse(localStorage.getItem('CS2_FLOAT_FEATURES') || '{}');
    } catch (error) {
      console.error('Error getting features:', error);
      return {};
    }
  }

  static setFeature(feature, value) {
    try {
      const features = this.getFeatures();
      features[feature] = value;
      localStorage.setItem('CS2_FLOAT_FEATURES', JSON.stringify(features));
    } catch (error) {
      console.error('Error setting feature:', error);
    }
  }

  static isEnabled(feature) {
    const features = this.getFeatures();
    const defaultFeatures = {
      enableMarket: true,
      enableInventory: true,
      autoLoad: true,
      showStickers: true,
      showKeychains: true
    };
    return features[feature] ?? defaultFeatures[feature] ?? false;
  }
}