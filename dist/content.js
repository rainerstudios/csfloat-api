/**
 * CS2 Float Extension - Content Script
 * Version 2.0.0 - Restored filter functionality
 */

console.log('🚀 CS2 Float Extension loaded on:', window.location.href);

// Global state
let minFloat = 0.00;
let maxFloat = 1.00;
let isProcessing = false;
let processedItems = new Set();

/**
 * Load simple FloatSorter component
 */
function loadFloatSorter() {
  // Check if already loaded
  if (window.FloatSorter) {
    return;
  }

  // Inject the float sorter script
  const script = document.createElement('script');
  script.type = 'module';
  script.textContent = `
    import { FloatSorter } from '${chrome.runtime.getURL('floatSorter.js')}';
    window.FloatSorter = FloatSorter;
    
    // Auto-initialize on CS2 item listing pages
    if (window.location.href.includes('/market/listings/') && !window.location.href.includes('/market/search')) {
      console.log('🎯 CS2 item listing detected, initializing FloatSorter...');
      setTimeout(() => {
        new FloatSorter();
      }, 2000);
    }
  `;
  
  (document.head || document.documentElement).appendChild(script);
  console.log('✅ FloatSorter loaded');
}

/**
 * Update filter status message
 */
function updateStatus(message) {
  const status = document.getElementById('filterStatus');
  if (status) {
    status.textContent = message;
  }
}

/**
 * Filter items based on float values
 */
async function filterItems() {
  if (isProcessing) {
    updateStatus('Already processing...');
    return;
  }

  isProcessing = true;
  updateStatus(`Filtering items (${minFloat.toFixed(2)} - ${maxFloat.toFixed(2)})...`);

  const items = document.querySelectorAll('.market_listing_row');
  let visibleCount = 0;
  let hiddenCount = 0;
  let processedCount = 0;

  for (const item of items) {
    processedCount++;
    
    // Get float value from the item
    const floatElement = item.querySelector('.cs2-float-value');
    if (floatElement) {
      const floatValue = parseFloat(floatElement.textContent);
      
      if (floatValue >= minFloat && floatValue <= maxFloat) {
        item.style.display = '';
        visibleCount++;
      } else {
        item.style.display = 'none';
        hiddenCount++;
      }
    } else {
      // If no float data yet, keep item visible for now
      item.style.display = '';
    }
    
    // Update status periodically
    if (processedCount % 5 === 0) {
      updateStatus(`Processing... ${processedCount}/${items.length}`);
    }
  }

  isProcessing = false;
  updateStatus(`Showing ${visibleCount} items, hidden ${hiddenCount}`);
}

/**
 * Process float values for items on the page
 */
async function processFloatValues() {
  const items = document.querySelectorAll('.market_listing_row');
  
  for (const item of items) {
    // Skip if already processed
    if (item.querySelector('.cs2-float-enhanced')) {
      continue;
    }

    // Find inspect link
    const inspectBtn = item.querySelector('a[href*="steam://rungame/730"]');
    if (!inspectBtn) continue;

    const inspectLink = inspectBtn.href;
    
    try {
      // Request float data from background
      const response = await chrome.runtime.sendMessage({
        action: 'fetchEnhancedFloat',
        inspectLink: inspectLink
      });

      if (response && response.enhancedData) {
        addFloatDisplay(item, response.enhancedData);
      }
    } catch (error) {
      console.error('Error fetching float:', error);
    }

    // Add delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

/**
 * Add float display to an item
 */
function addFloatDisplay(itemElement, floatData) {
  const container = document.createElement('div');
  container.className = 'cs2-float-enhanced';
  container.style.cssText = `
    background: linear-gradient(135deg, #1e3c72, #2a5298);
    color: white;
    padding: 6px 10px;
    margin: 4px 0;
    border-radius: 6px;
    font-size: 12px;
    display: flex;
    align-items: center;
    gap: 10px;
  `;

  // Create float value element for filtering
  const floatValue = document.createElement('span');
  floatValue.className = 'cs2-float-value';
  floatValue.textContent = floatData.floatValue.toFixed(6);
  floatValue.style.display = 'none'; // Hidden but used for filtering

  // Create visible display
  let displayHtml = `
    <div style="flex: 1;">
      <strong>${floatData.weaponName || 'Item'}</strong>
      <span style="margin-left: 8px;">Float: ${floatData.floatValue.toFixed(6)}</span>
      <span style="margin-left: 8px; opacity: 0.9;">${floatData.wearName}</span>
    </div>
  `;

  // Add pattern seed if available
  if (floatData.paintSeed) {
    displayHtml += `<div style="opacity: 0.9;">Pattern: #${floatData.paintSeed}</div>`;
  }

  // Add blue gem info if detected
  if (floatData.blueGemInfo) {
    displayHtml += `
      <div style="background: rgba(0,100,255,0.3); padding: 4px 8px; border-radius: 4px;">
        💎 ${floatData.blueGemInfo.bluePercentage}% Blue
      </div>
    `;
  }

  // Add investment score
  if (floatData.investmentScore) {
    const color = floatData.investmentScore >= 7 ? '#00ff00' : 
                  floatData.investmentScore >= 5 ? '#ffff00' : '#ff9900';
    displayHtml += `
      <div style="color: ${color}; font-weight: bold;">
        ★ ${floatData.investmentScore}/10
      </div>
    `;
  }

  container.innerHTML = displayHtml;
  container.appendChild(floatValue);
  
  // Insert after the item name
  const itemName = itemElement.querySelector('.market_listing_item_name_block');
  if (itemName) {
    itemName.parentNode.insertBefore(container, itemName.nextSibling);
  } else {
    itemElement.appendChild(container);
  }
}

/**
 * Initialize the extension
 */
function initialize() {
  console.log('🔧 Initializing CS2 Float Extension...');
  
  // Create filter UI on market pages
  if (window.location.pathname.includes('/market/')) {
    // Load the simple FloatSorter component
    loadFloatSorter();
    
    // Process items after a short delay
    setTimeout(() => {
      processFloatValues();
    }, 1000);
    
    // Monitor for new items (pagination, etc.)
    const observer = new MutationObserver((mutations) => {
      let hasNewItems = false;
      mutations.forEach(mutation => {
        if (mutation.addedNodes.length > 0) {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === 1 && node.classList?.contains('market_listing_row')) {
              hasNewItems = true;
            }
          });
        }
      });
      
      if (hasNewItems) {
        setTimeout(processFloatValues, 500);
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
  
  // Handle inventory pages
  if (window.location.pathname.includes('/inventory')) {
    console.log('📦 Inventory page detected');
    initializeInventoryChecker();
  }
}

/**
 * Initialize inventory checker for Steam inventory pages
 */
function initializeInventoryChecker() {
  console.log('🔧 Initializing inventory float checker...');
  
  const InventoryFloatChecker = {
    initialized: false,
    processedAssets: new Set(),
    
    init() {
      if (this.initialized) return;
      this.initialized = true;
      
      console.log('📦 Setting up inventory item click handler...');
      
      // Listen for clicks on inventory items
      document.addEventListener('click', (event) => {
        const clickedItem = event.target.closest('.item.app730.context2');
        if (clickedItem) {
          console.log(`🖱️ Clicked on CS2 item: ${clickedItem.id}`);
          
          // Wait for Steam to update the item info panel
          setTimeout(() => {
            this.processClickedItem(clickedItem.id);
          }, 500);
        }
      });
      
      this.waitForSteamInventory();
    },
    
    processClickedItem(itemId) {
      console.log(`🔍 Processing clicked item: ${itemId}`);
      
      // Extract float from the active item info panel
      const floatData = this.extractFloatFromActiveItemInfo();
      if (floatData) {
        console.log(`✅ Extracted float from Steam UI: ${floatData.float}`);
        this.displayFloatOnInventoryItem(itemId, floatData);
      } else {
        console.log(`❌ Could not extract float data for ${itemId}`);
      }
    },
    
    extractFloatFromActiveItemInfo() {
      // Check both iteminfo panels
      for (let i = 0; i <= 1; i++) {
        const itemInfoId = `iteminfo${i}`;
        const itemInfo = document.getElementById(itemInfoId);
        
        if (itemInfo && (itemInfo.style.opacity === '1' || itemInfo.style.zIndex > 1)) {
          const assetProps = document.getElementById(`${itemInfoId}_item_asset_properties_content`);
          if (assetProps && assetProps.textContent) {
            const text = assetProps.textContent;
            console.log(`📄 Found asset properties in ${itemInfoId}:`, text);
            
            // Extract float value (format: "Wear Rating: 0.359675586")
            const floatMatch = text.match(/Wear Rating:\s*([\d.]+)/);
            const seedMatch = text.match(/Pattern Template:\s*(\d+)/);
            
            if (floatMatch) {
              return {
                float: parseFloat(floatMatch[1]),
                paintSeed: seedMatch ? parseInt(seedMatch[1]) : null
              };
            }
          }
        }
      }
      
      return null;
    },
    
    displayFloatOnInventoryItem(itemId, floatData) {
      const itemElement = document.getElementById(itemId);
      if (!itemElement) return;
      
      // Remove existing float display
      const existingDisplay = itemElement.querySelector('.cs2-inventory-float');
      if (existingDisplay) {
        existingDisplay.remove();
      }
      
      // Create float display overlay
      const floatDisplay = document.createElement('div');
      floatDisplay.className = 'cs2-inventory-float';
      floatDisplay.style.cssText = `
        position: absolute;
        bottom: 2px;
        left: 2px;
        right: 2px;
        background: linear-gradient(135deg, #1e3c72, #2a5298);
        color: white;
        font-size: 10px;
        padding: 2px 4px;
        border-radius: 3px;
        text-align: center;
        font-weight: bold;
        z-index: 10;
        box-shadow: 0 1px 3px rgba(0,0,0,0.5);
      `;
      
      const wearName = this.getWearName(floatData.float);
      floatDisplay.innerHTML = `
        <div>Float: ${floatData.float.toFixed(6)}</div>
        ${floatData.paintSeed ? `<div style="font-size: 9px; opacity: 0.9;">Pattern: #${floatData.paintSeed}</div>` : ''}
      `;
      
      // Add color coding based on float value
      if (floatData.float < 0.07) {
        floatDisplay.style.background = 'linear-gradient(135deg, #22c55e, #16a34a)'; // Factory New - Green
      } else if (floatData.float > 0.8) {
        floatDisplay.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)'; // Battle-Scarred - Red
      }
      
      itemElement.appendChild(floatDisplay);
    },
    
    getWearName(floatValue) {
      if (floatValue < 0.07) return 'Factory New';
      if (floatValue < 0.15) return 'Minimal Wear';
      if (floatValue < 0.38) return 'Field-Tested';
      if (floatValue < 0.45) return 'Well-Worn';
      return 'Battle-Scarred';
    },
    
    waitForSteamInventory() {
      // Check if Steam's inventory system is available
      if (typeof g_ActiveInventory === 'undefined') {
        console.log('Steam inventory not ready, retrying in 1s...');
        setTimeout(() => this.waitForSteamInventory(), 1000);
        return;
      }
      
      console.log('✅ Steam inventory detected');
    }
  };
  
  // Initialize the inventory checker
  InventoryFloatChecker.init();
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}