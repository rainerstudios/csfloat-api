// Simple background script for CS2 Float Checker
chrome.runtime.onInstalled.addListener(() => {
  console.log('CS2 Float Checker installed');
  
  // Set default settings
  chrome.storage.local.set({
    settings: {
      autoLoad: true,
      showStickers: true,
      highlightLowFloat: true,
      highlightHighFloat: true,
      lowFloatThreshold: 0.07,
      highFloatThreshold: 0.93,
      showPaintSeed: true,
      showFloatRank: true
    },
    stats: {
      itemsChecked: 0,
      extensionVersion: '1.0.0'
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
  
  return true;
});