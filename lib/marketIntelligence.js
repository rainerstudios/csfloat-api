/**
 * Market Intelligence Module
 * Handles price history tracking and display
 */

/**
 * Integrate market intelligence into Steam's item info panel
 */
function integrateMarketIntelligenceIntoItemInfo() {
  console.log('🔗 Integrating market intelligence into item info panel...');

  // Monitor for item info panel changes
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList') {
        // Check if largeiteminfo content has been updated
        const itemInfoContent = document.getElementById('largeiteminfo_content');

        // Use the same item name detection method that works for the floating button
        const itemNameElement = document.querySelector('.market_listing_largeimage .market_listing_item_name') ||
                               document.querySelector('.market_listing_item_name') ||
                               document.querySelector('h1');
        const itemName = itemNameElement ? itemNameElement.textContent.trim() : null;

        if (itemInfoContent && itemName && !itemInfoContent.querySelector('#cs2-integrated-intelligence')) {
          setTimeout(() => {
            addMarketIntelligenceToItemInfo(itemInfoContent, itemName);
          }, 500);
        }
      }
    });
  });

  // Start observing
  const itemInfo = document.getElementById('largeiteminfo');
  if (itemInfo) {
    observer.observe(itemInfo, {
      childList: true,
      subtree: true
    });

    // Check if item info is already loaded
    const itemInfoContent = document.getElementById('largeiteminfo_content');

    // Use the same item name detection method that works for the floating button
    const itemNameElement = document.querySelector('.market_listing_largeimage .market_listing_item_name') ||
                           document.querySelector('.market_listing_item_name') ||
                           document.querySelector('h1');
    const itemName = itemNameElement ? itemNameElement.textContent.trim() : null;

    if (itemInfoContent && itemName) {
      setTimeout(() => {
        addMarketIntelligenceToItemInfo(itemInfoContent, itemName);
      }, 500);
    }
  }
}

/**
 * Add market intelligence section to item info panel
 */
async function addMarketIntelligenceToItemInfo(itemInfoContent, itemName) {
  // Don't add if already exists
  if (itemInfoContent.querySelector('#cs2-integrated-intelligence')) {
    return;
  }

  console.log('📊 Adding market intelligence to item info for:', itemName);

  try {
    // Request price history from background (try multiple name variations)
    let response = await chrome.runtime.sendMessage({
      action: 'getPriceHistory',
      itemName: itemName
    });

    // If no data found with exact name, try without condition suffix
    if (!response.success || !response.data || response.data.priceHistory.length === 0) {
      const baseItemName = itemName.replace(/\s*\([^)]*\)$/, ''); // Remove condition like "(Minimal Wear)"
      console.log('📊 Trying base item name:', baseItemName);

      response = await chrome.runtime.sendMessage({
        action: 'getPriceHistory',
        itemName: baseItemName
      });

      // Still no data? Let's see what items we DO have data for
      if (!response.success || !response.data || response.data.priceHistory.length === 0) {
        console.log('📊 No data found. Requesting all stored item names for debugging...');

        // Request a list of all stored item names for debugging
        chrome.runtime.sendMessage({ action: 'debugGetAllItemNames' }, (debugResponse) => {
          if (debugResponse && debugResponse.itemNames) {
            console.log('📊 Available tracked items:', debugResponse.itemNames);
            console.log('📊 Looking for:', itemName);
            console.log('📊 Base name:', baseItemName);
          }
        });
      }
    }

    // Create intelligence container
    const intelligenceContainer = document.createElement('div');
    intelligenceContainer.id = 'cs2-integrated-intelligence';
    intelligenceContainer.style.cssText = `
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

    if (response.success && response.data && response.data.priceHistory.length > 0) {
      const itemData = response.data;
      const priceHistory = itemData.priceHistory || [];
      const floatHistory = itemData.floatHistory || [];

      // Calculate market statistics
      const prices = priceHistory.map(p => p.price);
      const latestPrice = prices[prices.length - 1];
      const oldestPrice = prices[0];
      const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);
      const priceChange = ((latestPrice - oldestPrice) / oldestPrice * 100).toFixed(1);
      const volatility = ((maxPrice - minPrice) / avgPrice * 100).toFixed(1);

      // Calculate float statistics if available
      let floatStatsHtml = '';
      if (floatHistory.length > 1) {
        const floats = floatHistory.map(f => f.floatValue);
        const avgFloat = floats.reduce((a, b) => a + b, 0) / floats.length;
        const minFloatSeen = Math.min(...floats);
        const maxFloatSeen = Math.max(...floats);

        floatStatsHtml = `
          <div style="background: rgba(34, 197, 94, 0.15); padding: 8px; border-radius: 4px; margin-bottom: 8px;">
            <strong style="color: #22c55e;">🎯 Float Trends (${floats.length} samples)</strong><br>
            Average: ${avgFloat.toFixed(4)} | Range: ${minFloatSeen.toFixed(4)} - ${maxFloatSeen.toFixed(4)}
          </div>
        `;
      }

      const trendColor = parseFloat(priceChange) > 0 ? '#22c55e' : parseFloat(priceChange) < 0 ? '#ef4444' : '#6b7280';
      const volatilityColor = parseFloat(volatility) > 30 ? '#ef4444' : parseFloat(volatility) > 15 ? '#f59e0b' : '#22c55e';
      const trendArrow = parseFloat(priceChange) > 0 ? '↗' : parseFloat(priceChange) < 0 ? '↘' : '→';

      intelligenceContainer.innerHTML = `
        <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 8px;">
          <strong style="color: #4CAF50; font-size: 13px;">📊 Market Intelligence</strong>
          <span style="color: #888; font-size: 10px;">${priceHistory.length} data points</span>
        </div>

        ${floatStatsHtml}

        <div style="background: rgba(59, 130, 246, 0.15); padding: 8px; border-radius: 4px; margin-bottom: 8px;">
          <strong style="color: #3b82f6;">💰 Price Analysis</strong><br>
          <div style="margin-top: 4px;">
            Current: <strong>$${latestPrice.toFixed(2)}</strong> | Average: $${avgPrice.toFixed(2)}<br>
            Range: $${minPrice.toFixed(2)} - $${maxPrice.toFixed(2)}<br>
            <span style="color: ${trendColor};">Trend: ${trendArrow} ${priceChange}%</span> |
            <span style="color: ${volatilityColor};">Volatility: ${volatility}%</span>
          </div>
        </div>

        <div style="background: rgba(168, 85, 247, 0.15); padding: 8px; border-radius: 4px;">
          <strong style="color: #a855f7;">🎯 Investment Signals</strong><br>
          <div style="margin-top: 4px;">
            ${latestPrice < avgPrice * 0.9 ? '🟢 Below average price - Good buy opportunity' :
              latestPrice > avgPrice * 1.1 ? '🔴 Above average price - Consider waiting' : '🟡 Near average price - Fair value'}<br>
            ${parseFloat(volatility) > 25 ? '⚠️ High volatility - Risky investment' : '✅ Stable pricing - Safe investment'}
          </div>
        </div>

        <div style="text-align: center; margin-top: 8px; color: #888; font-size: 10px;">
          Data collected since ${new Date(itemData.firstSeen).toLocaleDateString()}
        </div>
      `;
    } else {
      intelligenceContainer.innerHTML = `
        <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 8px;">
          <strong style="color: #4CAF50; font-size: 13px;">📊 Market Intelligence</strong>
        </div>
        <div style="text-align: center; padding: 16px; color: #888;">
          No historical data yet for this item.<br>
          <small>Browse market listings to start collecting data.</small>
        </div>
      `;
    }

    // Insert into the item description area, after the main description
    const descriptors = itemInfoContent.querySelector('#largeiteminfo_item_descriptors');
    if (descriptors) {
      descriptors.parentNode.insertBefore(intelligenceContainer, descriptors.nextSibling);
    } else {
      // Fallback: append to the end of item_desc_description
      const description = itemInfoContent.querySelector('.item_desc_description');
      if (description) {
        description.appendChild(intelligenceContainer);
      }
    }

  } catch (error) {
    console.error('Error adding market intelligence to item info:', error);
  }
}

// Export functions for use in content.js
if (typeof window !== 'undefined') {
  window.MarketIntelligence = {
    integrateMarketIntelligenceIntoItemInfo,
    addMarketIntelligenceToItemInfo
  };
}