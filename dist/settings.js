/**
 * CS2 Float Extension - Settings Page
 */

let currentSettings = {};
let currentStats = {};

// Default settings
const defaultSettings = {
  enablePatternAnalysis: true,
  enableBlueGemDetection: true,
  enableMarketIntelligence: true,
  enableVisualFloatBars: true,
  floatPrecision: 6,
  showPercentileRank: true
};

/**
 * Load current settings and stats
 */
async function loadData() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getSettings' });
    if (response && response.settings) {
      currentSettings = { ...defaultSettings, ...response.settings };
    } else {
      currentSettings = { ...defaultSettings };
    }

    const statsResponse = await chrome.runtime.sendMessage({ action: 'getStats' });
    if (statsResponse && statsResponse.stats) {
      currentStats = statsResponse.stats;
    }

    updateUI();
  } catch (error) {
    console.error('Failed to load settings:', error);
    currentSettings = { ...defaultSettings };
    updateUI();
  }
}

/**
 * Update the UI with current settings
 */
function updateUI() {
  // Update toggles
  Object.keys(currentSettings).forEach(key => {
    const element = document.getElementById(key);
    if (element && typeof currentSettings[key] === 'boolean') {
      element.classList.toggle('active', currentSettings[key]);
    }
  });

  // Update range controls
  const precisionSlider = document.getElementById('floatPrecision');
  const precisionValue = document.getElementById('floatPrecisionValue');
  if (precisionSlider && precisionValue) {
    precisionSlider.value = currentSettings.floatPrecision || 6;
    precisionValue.textContent = currentSettings.floatPrecision || 6;
  }

  // Update stats
  if (currentStats) {
    const statsElements = {
      itemsAnalyzed: currentStats.itemsAnalyzed || 0,
      blueGemsDetected: currentStats.blueGemsDetected || 0,
      topTierFloatsFound: currentStats.topTierFloatsFound || 0,
      extensionVersion: currentStats.extensionVersion || '2.0.0'
    };

    Object.keys(statsElements).forEach(key => {
      const element = document.getElementById(key);
      if (element) {
        element.textContent = statsElements[key];
      }
    });
  }
}

/**
 * Save current settings
 */
async function saveSettings() {
  try {
    await chrome.runtime.sendMessage({
      action: 'saveSettings',
      settings: currentSettings
    });

    // Show success feedback
    const button = document.getElementById('saveSettings');
    const originalText = button.textContent;
    button.textContent = '✓ Saved!';
    button.style.background = '#4CAF50';
    
    setTimeout(() => {
      button.textContent = originalText;
      button.style.background = '';
    }, 2000);

  } catch (error) {
    console.error('Failed to save settings:', error);
    alert('Failed to save settings. Please try again.');
  }
}

/**
 * Reset settings to defaults
 */
function resetSettings() {
  if (confirm('Reset all settings to defaults? This cannot be undone.')) {
    currentSettings = { ...defaultSettings };
    updateUI();
    saveSettings();
  }
}

/**
 * Clear all data
 */
async function clearAllData() {
  if (confirm('Clear all extension data including cache and statistics? This cannot be undone.')) {
    try {
      await chrome.runtime.sendMessage({ action: 'clearCache' });
      await chrome.runtime.sendMessage({ action: 'clearStats' });
      
      currentStats = {};
      updateUI();
      
      alert('All data cleared successfully!');
    } catch (error) {
      console.error('Failed to clear data:', error);
      alert('Failed to clear data. Please try again.');
    }
  }
}

/**
 * Initialize settings page
 */
function initialize() {
  // Load current data
  loadData();

  // Setup toggle switches
  document.querySelectorAll('.toggle-switch').forEach(toggle => {
    toggle.addEventListener('click', () => {
      const settingKey = toggle.id;
      if (settingKey in currentSettings) {
        currentSettings[settingKey] = !currentSettings[settingKey];
        toggle.classList.toggle('active', currentSettings[settingKey]);
      }
    });
  });

  // Setup range controls
  const precisionSlider = document.getElementById('floatPrecision');
  const precisionValue = document.getElementById('floatPrecisionValue');
  
  precisionSlider.addEventListener('input', (e) => {
    const value = parseInt(e.target.value);
    currentSettings.floatPrecision = value;
    precisionValue.textContent = value;
  });

  // Setup action buttons
  document.getElementById('saveSettings').addEventListener('click', saveSettings);
  document.getElementById('resetSettings').addEventListener('click', resetSettings);
  document.getElementById('clearAllData').addEventListener('click', clearAllData);

  console.log('🚀 CS2 Float Extension Settings page loaded');
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initialize);