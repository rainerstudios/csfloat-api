/**
 * Inventory Enhancer Module
 * Enhances Steam inventory items with float data and market intelligence
 */

/**
 * Initialize inventory enhancements
 */
function initializeInventoryEnhancer() {
  console.log('🎒 Initializing inventory enhancements...');

  // Function to check and enhance visible item info panels
  function checkAndEnhanceItemPanels() {
    // Check both item info panels
    for (let i = 0; i <= 1; i++) {
      const itemInfoPanel = document.getElementById(`iteminfo${i}`);
      const itemInfoContent = document.getElementById(`iteminfo${i}_content`);

      if (itemInfoPanel && itemInfoContent) {
        // Check if panel is visible (not display:none and has opacity > 0)
        const style = window.getComputedStyle(itemInfoPanel);
        const isVisible = style.display !== 'none' && parseFloat(style.opacity || '1') > 0;

        if (isVisible && !itemInfoContent.querySelector('#cs2-inventory-enhancement')) {
          console.log(`🎯 Found visible item panel: iteminfo${i}`);
          enhanceInventoryItem(itemInfoContent, `iteminfo${i}`);
        }
      }
    }
  }

  // Monitor for inventory item selections and visibility changes
  const observer = new MutationObserver((mutations) => {
    let shouldCheck = false;

    mutations.forEach((mutation) => {
      // Check for changes to item info panels
      if (mutation.type === 'attributes' &&
          (mutation.target.id === 'iteminfo0' || mutation.target.id === 'iteminfo1') &&
          (mutation.attributeName === 'style' || mutation.attributeName === 'class')) {
        shouldCheck = true;
      }

      // Check for new content added to item info panels
      if (mutation.type === 'childList' &&
          (mutation.target.id && mutation.target.id.includes('iteminfo'))) {
        shouldCheck = true;
      }
    });

    if (shouldCheck) {
      setTimeout(checkAndEnhanceItemPanels, 100);
    }
  });

  // Start observing the inventory page
  const inventoryPage = document.getElementById('active_inventory_page');
  if (inventoryPage) {
    observer.observe(inventoryPage, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class']
    });

    console.log('✅ Observer attached to inventory page');
  } else {
    // Fallback: observe the whole body
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class']
    });

    console.log('⚠️ Fallback: Observer attached to body');
  }

  // Initial check for already visible items
  setTimeout(checkAndEnhanceItemPanels, 500);
}

/**
 * Enhance individual inventory item
 */
async function enhanceInventoryItem(itemInfoContent, panelId) {
  try {
    // Don't add if already enhanced
    if (itemInfoContent.querySelector('#cs2-inventory-enhancement')) {
      console.log('🎒 Item already enhanced, skipping');
      return;
    }

    // Get item name
    const itemNameElement = itemInfoContent.querySelector('.hover_item_name');
    if (!itemNameElement) {
      console.log('🎒 No item name found');
      return;
    }

    const itemName = itemNameElement.textContent.trim();
    console.log('🎒 Processing inventory item:', itemName);

    // Check if this is a CS2 item
    const gameInfo = itemInfoContent.querySelector('.item_desc_game_info');
    const isCS2Item = gameInfo && gameInfo.textContent.includes('Counter-Strike 2');

    if (!isCS2Item) {
      console.log('🎒 Not a CS2 item, skipping enhancement');
      return;
    }

    // Extract float data from Steam's asset properties
    const floatData = extractFloatDataFromAssetProperties(itemInfoContent);
    if (!floatData) {
      console.log('🎒 No float data found in asset properties for:', itemName);
      return;
    }

    console.log('✅ Extracted float data:', floatData);

    // Get inspect link for additional features
    const inspectLink = getInspectLinkFromInventoryItem(itemInfoContent);

    // Add enhancement to the item info panel
    await addInventoryEnhancement(itemInfoContent, floatData, itemName, inspectLink);

  } catch (error) {
    console.error('Error enhancing inventory item:', error);
  }
}

/**
 * Extract float data from Steam's asset properties
 */
function extractFloatDataFromAssetProperties(itemInfoContent) {
  const assetPropsElement = itemInfoContent.querySelector('#iteminfo0_item_asset_properties_content, #iteminfo1_item_asset_properties_content');
  if (!assetPropsElement) return null;

  const assetText = assetPropsElement.textContent || assetPropsElement.innerHTML;
  console.log('🔍 Asset properties text:', assetText);

  // Extract float value (Wear Rating)
  const wearMatch = assetText.match(/Wear Rating:\s*([\d.]+)/);
  if (!wearMatch) return null;

  const floatValue = parseFloat(wearMatch[1]);

  // Extract pattern seed (Pattern Template)
  const patternMatch = assetText.match(/Pattern Template:\s*(\d+)/);
  const paintSeed = patternMatch ? parseInt(patternMatch[1]) : null;

  // Determine wear name based on float value
  const wearName = getWearNameFromFloat(floatValue);

  // Calculate some basic statistics
  const precision = Math.max(6, (floatValue.toString().split('.')[1] || '').length);

  // Create enhanced float data structure
  const floatData = {
    floatValue: floatValue,
    paintSeed: paintSeed,
    wearName: wearName,
    precision: precision,
    min: getMinFloatForWear(wearName),
    max: getMaxFloatForWear(wearName),
    weaponName: extractWeaponName(itemInfoContent),
    fullItemName: itemInfoContent.querySelector('.hover_item_name')?.textContent?.trim() || 'Unknown Item'
  };

  return floatData;
}

/**
 * Get wear name from float value
 */
function getWearNameFromFloat(floatValue) {
  if (floatValue < 0.07) return 'Factory New';
  if (floatValue < 0.15) return 'Minimal Wear';
  if (floatValue < 0.38) return 'Field-Tested';
  if (floatValue < 0.45) return 'Well-Worn';
  return 'Battle-Scarred';
}

/**
 * Get approximate min float for wear category
 */
function getMinFloatForWear(wearName) {
  switch (wearName) {
    case 'Factory New': return 0.00;
    case 'Minimal Wear': return 0.07;
    case 'Field-Tested': return 0.15;
    case 'Well-Worn': return 0.38;
    case 'Battle-Scarred': return 0.45;
    default: return 0.00;
  }
}

/**
 * Get approximate max float for wear category
 */
function getMaxFloatForWear(wearName) {
  switch (wearName) {
    case 'Factory New': return 0.07;
    case 'Minimal Wear': return 0.15;
    case 'Field-Tested': return 0.38;
    case 'Well-Worn': return 0.45;
    case 'Battle-Scarred': return 1.00;
    default: return 1.00;
  }
}

/**
 * Extract weapon name from item info
 */
function extractWeaponName(itemInfoContent) {
  const itemName = itemInfoContent.querySelector('.hover_item_name')?.textContent?.trim() || '';
  // Extract weapon part (before the |)
  const parts = itemName.split('|');
  return parts.length > 1 ? parts[0].trim() : itemName;
}

/**
 * Extract inspect link from inventory item
 */
function getInspectLinkFromInventoryItem(itemInfoContent) {
  // Look for inspect button in item actions
  const inspectBtn = itemInfoContent.querySelector('a[href*="steam://rungame/730"]');
  if (inspectBtn) {
    return inspectBtn.href;
  }

  // Alternative: look in the global item data if available
  if (typeof g_ActiveInventory !== 'undefined' && g_ActiveInventory.selectedItem) {
    const selectedItem = g_ActiveInventory.selectedItem;
    if (selectedItem.description && selectedItem.description.actions) {
      const inspectAction = selectedItem.description.actions.find(action =>
        action.link && action.link.includes('csgo_econ_action_preview')
      );

      if (inspectAction && g_ActiveInventory.m_owner) {
        return inspectAction.link
          .replace('%owner_steamid%', g_ActiveInventory.m_owner.strSteamId)
          .replace('%assetid%', selectedItem.assetid);
      }
    }
  }

  return null;
}

/**
 * Add enhancement panel to inventory item
 */
async function addInventoryEnhancement(itemInfoContent, floatData, itemName, inspectLink) {
  // Create enhancement container
  const enhancementContainer = document.createElement('div');
  enhancementContainer.id = 'cs2-inventory-enhancement';
  enhancementContainer.style.cssText = `
    background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
    border: 1px solid #3a3a3a;
    border-radius: 6px;
    padding: 12px;
    margin: 8px 0;
    color: white;
    font-family: Arial, sans-serif;
    font-size: 12px;
    line-height: 1.4;
  `;

  // Calculate additional statistics
  const floatRank = calculateFloatPercentile(floatData.floatValue, floatData.min, floatData.max);
  const wearPercentage = ((floatData.floatValue - floatData.min) / (floatData.max - floatData.min) * 100);

  // Build enhancement HTML
  let enhancementHtml = `
    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
      <strong style="color: #4CAF50; font-size: 13px;">🔬 CS2 Float Analysis</strong>
    </div>

    <div style="background: rgba(34, 197, 94, 0.15); padding: 8px; border-radius: 4px; margin-bottom: 8px;">
      <strong style="color: #22c55e;">📊 Float Details</strong><br>
      <div style="margin-top: 4px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
        <div>
          <span class="cs2-inventory-float-copy" style="cursor: pointer; text-decoration: underline;" title="Click to copy">
            Float: ${floatData.floatValue.toFixed(floatData.precision || 6)}
          </span><br>
          <small style="color: #888;">Wear: ${wearPercentage.toFixed(1)}% (${floatData.wearName})</small>
        </div>
        <div>
          <span class="cs2-inventory-seed-copy" style="cursor: pointer; text-decoration: underline;" title="Click to copy">
            Pattern: #${floatData.paintSeed}
          </span><br>
          <small style="color: #888;">Rank: ~${floatRank}th percentile</small>
        </div>
      </div>
    </div>
  `;

  // Add float bar visualization
  const floatPosition = ((floatData.floatValue - floatData.min) / (floatData.max - floatData.min) * 100);
  enhancementHtml += `
    <div style="margin-bottom: 8px;">
      <small style="color: #888; margin-bottom: 4px; display: block;">Float Range: ${floatData.min} - ${floatData.max}</small>
      <div style="width: 100%; height: 6px; background: linear-gradient(to right, #22c55e 0%, #84cc16 20%, #eab308 40%, #f97316 70%, #dc2626 100%); border-radius: 3px; position: relative;">
        <div style="position: absolute; left: ${Math.max(0, Math.min(100, floatPosition))}%; top: 0; width: 2px; height: 6px; background: white; border-radius: 1px; box-shadow: 0 0 3px rgba(0,0,0,0.8);"></div>
      </div>
    </div>
  `;

  // Blue gem analysis removed - requires proper API support

  // Add investment score
  if (floatData.investmentScore) {
    const scoreColor = floatData.investmentScore >= 7 ? '#22c55e' :
                       floatData.investmentScore >= 5 ? '#eab308' : '#f97316';

    enhancementHtml += `
      <div style="background: rgba(168, 85, 247, 0.15); padding: 8px; border-radius: 4px; margin-bottom: 8px;">
        <strong style="color: #a855f7;">🎯 Investment Analysis</strong><br>
        <div style="margin-top: 4px;">
          Score: <strong style="color: ${scoreColor};">★ ${floatData.investmentScore}/10</strong><br>
          <small style="color: #888;">Based on float, rarity, and pattern analysis</small>
        </div>
      </div>
    `;
  }

  // Add sticker information if available
  if (floatData.stickers && floatData.stickers.length > 0) {
    enhancementHtml += `
      <div style="background: rgba(255, 193, 7, 0.15); padding: 8px; border-radius: 4px; margin-bottom: 8px;">
        <strong style="color: #ffc107;">🏷️ Stickers Applied (${floatData.stickers.length})</strong><br>
        <div style="margin-top: 4px; font-size: 11px;">
          ${floatData.stickers.map(sticker => `• ${sticker.name || 'Unknown Sticker'}`).join('<br>')}
        </div>
      </div>
    `;
  }

  // Add market intelligence link
  enhancementHtml += `
    <div style="text-align: center; margin-top: 8px;">
      <button id="cs2-inventory-market-analysis" style="
        background: #3b82f6;
        color: white;
        border: none;
        padding: 6px 12px;
        border-radius: 4px;
        font-size: 11px;
        cursor: pointer;
        font-weight: bold;
      ">📊 View Market Analysis</button>
    </div>
  `;

  enhancementContainer.innerHTML = enhancementHtml;

  // Find insertion point (after game info)
  const gameInfo = itemInfoContent.querySelector('.item_desc_game_info');
  if (gameInfo) {
    gameInfo.parentNode.insertBefore(enhancementContainer, gameInfo.nextSibling);
  } else {
    // Fallback: append to description area
    const description = itemInfoContent.querySelector('.item_desc_description');
    if (description) {
      description.appendChild(enhancementContainer);
    }
  }

  // Add click-to-copy functionality
  setupInventoryClickToCopy(enhancementContainer, floatData);

  // Add market analysis button handler
  setupMarketAnalysisButton(enhancementContainer, itemName, inspectLink);

  console.log('✅ Inventory item enhanced successfully');
}

/**
 * Setup click-to-copy functionality for inventory items
 */
function setupInventoryClickToCopy(container, floatData) {
  // Copy float value
  const floatElement = container.querySelector('.cs2-inventory-float-copy');
  if (floatElement) {
    floatElement.addEventListener('click', async () => {
      const floatText = floatData.floatValue.toFixed(floatData.precision || 6);
      try {
        await navigator.clipboard.writeText(floatText);
        showInventoryCopyNotification(floatElement, `Copied: ${floatText}`, 'success');
      } catch (err) {
        // Fallback
        const textArea = document.createElement('textarea');
        textArea.value = floatText;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showInventoryCopyNotification(floatElement, `Copied: ${floatText}`, 'success');
      }
    });
  }

  // Copy pattern seed
  const seedElement = container.querySelector('.cs2-inventory-seed-copy');
  if (seedElement) {
    seedElement.addEventListener('click', async () => {
      const seedText = floatData.paintSeed.toString();
      try {
        await navigator.clipboard.writeText(seedText);
        showInventoryCopyNotification(seedElement, `Copied: ${seedText}`, 'success');
      } catch (err) {
        // Fallback
        const textArea = document.createElement('textarea');
        textArea.value = seedText;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showInventoryCopyNotification(seedElement, `Copied: ${seedText}`, 'success');
      }
    });
  }
}

/**
 * Setup market analysis button
 */
function setupMarketAnalysisButton(container, itemName, inspectLink) {
  const button = container.querySelector('#cs2-inventory-market-analysis');
  if (button) {
    button.addEventListener('click', () => {
      // Open Steam Community Market for this item
      const marketUrl = `https://steamcommunity.com/market/search?q=${encodeURIComponent(itemName)}`;
      window.open(marketUrl, '_blank');
    });
  }
}

/**
 * Show copy notification for inventory items
 */
function showInventoryCopyNotification(element, message, type = 'info') {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: absolute;
    background: ${type === 'success' ? '#22c55e' : '#3b82f6'};
    color: white;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 11px;
    z-index: 10000;
    pointer-events: none;
    white-space: nowrap;
  `;
  notification.textContent = message;

  // Position notification
  const rect = element.getBoundingClientRect();
  notification.style.left = (rect.left + window.scrollX) + 'px';
  notification.style.top = (rect.top + window.scrollY - 30) + 'px';

  document.body.appendChild(notification);

  // Remove after delay
  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  }, 2000);
}

/**
 * Calculate float percentile rank
 */
function calculateFloatPercentile(floatValue, min, max) {
  const range = max - min;
  const position = floatValue - min;
  const percentile = (position / range) * 100;

  // Convert to rank (lower float = better rank)
  const rank = Math.round(100 - percentile);
  return Math.max(1, Math.min(99, rank));
}

// Export for use in content.js
if (typeof window !== 'undefined') {
  window.InventoryEnhancer = {
    initializeInventoryEnhancer
  };
}