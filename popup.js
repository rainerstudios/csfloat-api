document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  loadStats();
  setupEventListeners();
});

function loadSettings() {
  chrome.storage.local.get(['settings'], (result) => {
    const settings = result.settings || getDefaultSettings();
    
    updateToggle('enableMarket', settings.enableMarket);
    updateToggle('enableInventory', settings.enableInventory);
    updateToggle('autoLoad', settings.autoLoad);
    updateToggle('showStickers', settings.showStickers);
    updateToggle('showKeychains', settings.showKeychains);
    updateToggle('highlightLow', settings.highlightLowFloat);
    updateToggle('highlightHigh', settings.highlightHighFloat);
    
    document.getElementById('lowThreshold').value = settings.lowFloatThreshold || 0.07;
    document.getElementById('highThreshold').value = settings.highFloatThreshold || 0.93;
    
    const floatPrecisionElement = document.getElementById('floatPrecision');
    if (floatPrecisionElement) {
      floatPrecisionElement.value = settings.floatPrecision || 4;
    }
    
    const cacheExpiryElement = document.getElementById('cacheExpiry');
    if (cacheExpiryElement) {
      cacheExpiryElement.value = settings.cacheExpiry || 24;
    }
    
    const languageElement = document.getElementById('language');
    if (languageElement) {
      languageElement.value = settings.language || 'en';
    }
  });
}

function loadStats() {
  chrome.storage.local.get(['stats'], (result) => {
    const stats = result.stats || { itemsChecked: 0, cacheSize: 0 };
    document.getElementById('itemsChecked').textContent = stats.itemsChecked;
    document.getElementById('cacheSize').textContent = stats.cacheSize;
  });
}

function getDefaultSettings() {
  return {
    enableMarket: true,
    enableInventory: true,
    autoLoad: true,
    showStickers: true,
    showKeychains: true,
    highlightLowFloat: true,
    highlightHighFloat: true,
    lowFloatThreshold: 0.07,
    highFloatThreshold: 0.93,
    showFloatRank: true,
    showPaintSeed: true,
    floatPrecision: 4,
    cacheExpiry: 24,
    language: 'en'
  };
}

function updateToggle(id, value) {
  const toggle = document.getElementById(id);
  if (value) {
    toggle.classList.add('active');
  } else {
    toggle.classList.remove('active');
  }
}

function setupEventListeners() {
  document.querySelectorAll('.toggle').forEach(toggle => {
    toggle.addEventListener('click', () => {
      toggle.classList.toggle('active');
      saveSettings();
    });
  });
  
  document.querySelectorAll('input[type="number"]').forEach(input => {
    input.addEventListener('change', saveSettings);
  });
  
  document.querySelectorAll('select').forEach(select => {
    select.addEventListener('change', saveSettings);
  });
  
  document.getElementById('reloadFloats').addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        const url = tabs[0].url;
        console.log('Current URL:', url);
        
        // Check if we're on a supported Steam page
        if (!url.includes('steamcommunity.com/market/')) {
          showNotification('Navigate to Steam Market first!', 'warning');
          return;
        }
        
        chrome.tabs.sendMessage(tabs[0].id, { action: 'reloadFloats' }, (response) => {
          if (chrome.runtime.lastError) {
            console.log('Extension not active on this page:', chrome.runtime.lastError);
            showNotification('Extension loading... Try refreshing the page!', 'warning');
          } else if (response && response.success) {
            showNotification('Floats reloaded successfully!');
          } else {
            showNotification('No items found on this page', 'info');
          }
        });
      }
    });
  });
  
  document.getElementById('clearCache').addEventListener('click', () => {
    chrome.storage.local.remove(['floatCache'], () => {
      chrome.storage.local.set({ stats: { itemsChecked: 0, cacheSize: 0 } });
      loadStats();
      showNotification('Cache cleared!');
    });
  });
  
  document.getElementById('openSteam').addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://steamcommunity.com/market/search?appid=730' });
  });
  
  // Manual inspect functionality
  document.getElementById('checkManual').addEventListener('click', checkManualFloat);
  document.getElementById('manualInspect').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      checkManualFloat();
    }
  });
}

async function checkManualFloat() {
  const inputElement = document.getElementById('manualInspect');
  const resultElement = document.getElementById('manualResult');
  const buttonElement = document.getElementById('checkManual');
  const inspectLink = inputElement.value.trim();
  
  if (!inspectLink) {
    showNotification('Please enter an inspect link', 'warning');
    return;
  }
  
  // Validate inspect link format
  if (!inspectLink.startsWith('steam://rungame/730/')) {
    showNotification('Invalid inspect link format', 'error');
    return;
  }
  
  // Show loading state
  buttonElement.disabled = true;
  buttonElement.textContent = 'Checking...';
  resultElement.style.display = 'none';
  
  try {
    // Call API directly from popup
    const params = new URLSearchParams({ url: inspectLink });
    const response = await fetch(`https://api.cs2floatchecker.com/?${params}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'CS2FLOAT-Extension/1.5.0'
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`API request failed: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    
    if (data.iteminfo) {
      const floatData = processApiResponse(data);
      displayManualResult(floatData);
      showNotification('Float data loaded successfully!', 'success');
    } else {
      throw new Error('No item data received from API');
    }
  } catch (error) {
    console.error('Manual float check failed:', error);
    showNotification(`Error: ${error.message}`, 'error');
    resultElement.style.display = 'none';
  } finally {
    // Reset button state
    buttonElement.disabled = false;
    buttonElement.textContent = 'Check Float';
  }
}

function processApiResponse(data) {
  const floatValue = data.iteminfo?.floatvalue;
  const wear = data.iteminfo?.wear_name || getWearName(floatValue);
  
  return {
    floatValue: floatValue,
    paintSeed: data.iteminfo?.paintseed,
    paintIndex: data.iteminfo?.paintindex,
    defIndex: data.iteminfo?.defindex,
    origin: data.iteminfo?.origin,
    quality: data.iteminfo?.quality,
    rarity: data.iteminfo?.rarity,
    min: data.iteminfo?.min || 0,
    max: data.iteminfo?.max || 1,
    weaponType: data.iteminfo?.weapon_type,
    itemName: data.iteminfo?.item_name || data.iteminfo?.full_item_name,
    fullItemName: data.iteminfo?.full_item_name,
    rarityName: data.iteminfo?.rarity_name,
    qualityName: data.iteminfo?.quality_name,
    originName: data.iteminfo?.origin_name,
    imageUrl: data.iteminfo?.imageurl,
    wear: wear,
    floatRank: getFloatPercentage(floatValue, data.iteminfo?.min || 0, data.iteminfo?.max || 1).toFixed(2),
    lowFloat: floatValue < 0.07,
    highFloat: floatValue > 0.93,
    isStatTrak: data.iteminfo?.quality === 9,
    isSouvenir: data.iteminfo?.quality === 12,
    timestamp: Date.now()
  };
}

function getWearName(floatValue) {
  if (floatValue < 0.07) return 'Factory New';
  if (floatValue < 0.15) return 'Minimal Wear';
  if (floatValue < 0.37) return 'Field-Tested';
  if (floatValue < 0.44) return 'Well-Worn';
  return 'Battle-Scarred';
}

function getFloatPercentage(floatValue, min = 0, max = 1) {
  return ((floatValue - min) / (max - min)) * 100;
}

function displayManualResult(floatData) {
  const resultElement = document.getElementById('manualResult');
  
  chrome.storage.local.get(['settings'], (result) => {
    const settings = result.settings || getDefaultSettings();
    const precision = settings.floatPrecision || 6;
    const floatValue = floatData.floatValue?.toFixed(precision) || 'N/A';
    const wear = floatData.wear || 'Unknown';
    const paintSeed = floatData.paintSeed || 'N/A';
    const paintIndex = floatData.paintIndex || 'N/A';
    const itemName = floatData.itemName || 'CS2 Item';
  
  resultElement.innerHTML = `
    <div class="float-display">
      <div class="float-value">${floatValue}</div>
      <div class="wear-name">${wear}</div>
    </div>
    <div class="detail-row">
      <span class="detail-label">Item:</span>
      <span class="detail-value">${itemName}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">Paint Seed:</span>
      <span class="detail-value">${paintSeed}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">Paint Index:</span>
      <span class="detail-value">${paintIndex}</span>
    </div>
    ${floatData.min && floatData.max ? `
    <div class="detail-row">
      <span class="detail-label">Range:</span>
      <span class="detail-value">${floatData.min} - ${floatData.max}</span>
    </div>
    ` : ''}
    ${floatData.floatRank ? `
    <div class="detail-row">
      <span class="detail-label">Rank:</span>
      <span class="detail-value">Top ${floatData.floatRank}%</span>
    </div>
    ` : ''}
  `;
  
  resultElement.style.display = 'block';
  });
}

function showNotification(message, type = 'info') {
  // Create notification element
  const notification = document.createElement('div');
  notification.className = `notification ${type} show`;
  notification.textContent = message;
  
  document.body.appendChild(notification);
  
  // Auto-hide after 3 seconds
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

function saveSettings() {
  const settings = {
    enableMarket: document.getElementById('enableMarket').classList.contains('active'),
    enableInventory: document.getElementById('enableInventory').classList.contains('active'),
    autoLoad: document.getElementById('autoLoad').classList.contains('active'),
    showStickers: document.getElementById('showStickers').classList.contains('active'),
    showKeychains: document.getElementById('showKeychains').classList.contains('active'),
    highlightLowFloat: document.getElementById('highlightLow').classList.contains('active'),
    highlightHighFloat: document.getElementById('highlightHigh').classList.contains('active'),
    lowFloatThreshold: parseFloat(document.getElementById('lowThreshold').value) || 0.07,
    highFloatThreshold: parseFloat(document.getElementById('highThreshold').value) || 0.93,
    floatPrecision: parseInt(document.getElementById('floatPrecision')?.value) || 4,
    cacheExpiry: parseInt(document.getElementById('cacheExpiry')?.value) || 24,
    language: document.getElementById('language')?.value || 'en',
    showFloatRank: true,
    showPaintSeed: true
  };
  
  chrome.storage.local.set({ settings }, () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'updateSettings', settings }, (response) => {
          if (chrome.runtime.lastError) {
            // Silently ignore - extension may not be active on current tab
            console.log('Settings saved locally');
          }
        });
      }
    });
  });
}

