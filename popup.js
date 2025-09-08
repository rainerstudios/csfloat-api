document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  loadStats();
  setupEventListeners();
});

function loadSettings() {
  chrome.storage.local.get(['settings'], (result) => {
    const settings = result.settings || getDefaultSettings();
    
    updateToggle('autoLoad', settings.autoLoad);
    updateToggle('showStickers', settings.showStickers);
    updateToggle('highlightLow', settings.highlightLowFloat);
    updateToggle('highlightHigh', settings.highlightHighFloat);
    
    document.getElementById('lowThreshold').value = settings.lowFloatThreshold || 0.07;
    document.getElementById('highThreshold').value = settings.highFloatThreshold || 0.93;
    
    const floatPrecisionElement = document.getElementById('floatPrecision');
    if (floatPrecisionElement) {
      floatPrecisionElement.value = settings.floatPrecision || 6;
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
    autoLoad: true,
    showStickers: true,
    highlightLowFloat: true,
    highlightHighFloat: true,
    lowFloatThreshold: 0.07,
    highFloatThreshold: 0.93,
    showFloatRank: true,
    showPaintSeed: true,
    floatPrecision: 6
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
    // Send message to content script to fetch float data
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs[0]) {
      throw new Error('No active tab found');
    }
    
    const response = await chrome.tabs.sendMessage(tabs[0].id, {
      action: 'checkManualFloat',
      inspectLink: inspectLink
    });
    
    if (response && response.success && response.data) {
      displayManualResult(response.data);
      showNotification('Float data loaded successfully!', 'success');
    } else {
      throw new Error(response?.error || 'No float data received');
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
    autoLoad: document.getElementById('autoLoad').classList.contains('active'),
    showStickers: document.getElementById('showStickers').classList.contains('active'),
    highlightLowFloat: document.getElementById('highlightLow').classList.contains('active'),
    highlightHighFloat: document.getElementById('highlightHigh').classList.contains('active'),
    lowFloatThreshold: parseFloat(document.getElementById('lowThreshold').value) || 0.07,
    highFloatThreshold: parseFloat(document.getElementById('highThreshold').value) || 0.93,
    floatPrecision: parseInt(document.getElementById('floatPrecision')?.value) || 6,
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

function showNotification(message) {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: #11998e;
    color: white;
    padding: 10px 20px;
    border-radius: 6px;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
    z-index: 1000;
    animation: slideDown 0.3s ease-out;
  `;
  notification.textContent = message;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.animation = 'slideUp 0.3s ease-out';
    setTimeout(() => notification.remove(), 300);
  }, 2000);
}

const style = document.createElement('style');
style.textContent = `
  @keyframes slideDown {
    from {
      transform: translateX(-50%) translateY(-100%);
      opacity: 0;
    }
    to {
      transform: translateX(-50%) translateY(0);
      opacity: 1;
    }
  }
  
  @keyframes slideUp {
    from {
      transform: translateX(-50%) translateY(0);
      opacity: 1;
    }
    to {
      transform: translateX(-50%) translateY(-100%);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);