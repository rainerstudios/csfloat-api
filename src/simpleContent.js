/**
 * CS2 Float Checker - Simple Content Script
 * Focuses on core float checking functionality
 */

class SimpleCS2FloatChecker {
  constructor() {
    this.floatAPI = null;
    this.processedItems = new Set();
    this.settings = this.getDefaultSettings();
    this.init();
  }

  getDefaultSettings() {
    return {
      autoLoad: true,
      showStickers: true,
      highlightLowFloat: true,
      highlightHighFloat: true,
      lowFloatThreshold: 0.07,
      highFloatThreshold: 0.93,
      showPaintSeed: true,
      showFloatRank: true,
      floatPrecision: 6
    };
  }

  async init() {
    try {
      // Initialize FloatAPI first
      if (window.FloatAPI) {
        this.floatAPI = new FloatAPI();
        console.log('FloatAPI initialized successfully');
      } else {
        console.error('FloatAPI not available');
        return;
      }
      
      await this.loadSettings();
      this.injectStyles();
      
      // Auto-load floats if enabled
      if (this.settings.autoLoad) {
        setTimeout(() => this.processPage(), 1000);
      }
      
      this.setupObserver();
      this.addControls();
      
      chrome.runtime.onMessage.addListener(this.handleMessage.bind(this));
      console.log('CS2 Float Checker initialized successfully');
    } catch (error) {
      console.error('Failed to initialize CS2 Float Checker:', error);
    }
  }

  async loadSettings() {
    try {
      const result = await chrome.storage.local.get(['settings']);
      if (result.settings) {
        this.settings = { ...this.settings, ...result.settings };
      }
    } catch (e) {
      console.log('Using default settings');
    }
  }

  processPage() {
    const hostname = window.location.hostname;
    const pathname = window.location.pathname;
    
    // Steam Community only - focused approach
    if (hostname.includes('steamcommunity.com')) {
      if (pathname.includes('/market/')) {
        this.processMarketListings();
      } else if (pathname.includes('/inventory/')) {
        this.processInventoryItems();
      } else if (pathname.includes('/tradehistory')) {
        this.processTradeHistory();
      } else if (pathname.includes('/tradeoffer/')) {
        this.processTradeOffer();
      }
    }
  }

  async processMarketListings() {
    const listings = document.querySelectorAll('.market_listing_row');
    const batch = [];
    
    for (const listing of listings) {
      if (this.processedItems.has(listing)) continue;
      
      const inspectLink = this.extractInspectLink(listing);
      if (inspectLink) {
        batch.push({ element: listing, link: inspectLink });
        this.processedItems.add(listing);
      }
    }
    
    if (batch.length === 0) return;
    
    console.log(`Processing ${batch.length} market listings...`);
    
    // Process in smaller batches to avoid rate limits
    for (let i = 0; i < batch.length; i += 5) {
      const chunk = batch.slice(i, i + 5);
      await this.processBatch(chunk);
      
      // Small delay between batches
      if (i + 5 < batch.length) {
        await this.delay(500);
      }
    }
  }

  async processBatch(items) {
    if (!this.floatAPI) {
      console.error('FloatAPI not initialized');
      return;
    }
    
    const promises = items.map(item => 
      this.floatAPI.getItemFloat(item.link)
        .then(data => ({ element: item.element, data }))
        .catch(err => ({ element: item.element, error: err }))
    );
    
    const results = await Promise.allSettled(promises);
    
    results.forEach(result => {
      if (result.status === 'fulfilled' && result.value.data) {
        this.displayFloatInfo(result.value.element, result.value.data);
      }
    });
  }

  async processInventoryItems() {
    const items = document.querySelectorAll('.item.app730');
    let processed = 0;
    
    for (const item of items) {
      if (this.processedItems.has(item)) continue;
      
      const inspectLink = this.extractInventoryInspectLink(item);
      if (inspectLink) {
        try {
          const floatData = await this.floatAPI.getItemFloat(inspectLink);
          if (floatData) {
            this.displayFloatBadge(item, floatData);
            processed++;
          }
        } catch (e) {
          console.log('Float fetch failed:', e.message);
        }
        
        this.processedItems.add(item);
        
        // Rate limiting
        if (processed % 3 === 0) {
          await this.delay(200);
        }
      }
    }
    
    if (processed > 0) {
      this.showToast(`Loaded ${processed} inventory floats`);
    }
  }

  extractInspectLink(element) {
    // Enhanced Steam integration - try Steam's global variables first
    const steamData = this.getSteamItemData(element);
    if (steamData?.inspectLink) {
      return steamData.inspectLink;
    }
    
    // Fallback: Look for inspect buttons
    const inspectBtn = element.querySelector('a[href*="csgo_econ_action_preview"]');
    if (inspectBtn) {
      const match = inspectBtn.href.match(/steam:\/\/rungame\/730\/[^'"]+/);
      return match ? match[0] : null;
    }
    
    // Look in onclick handlers
    const actionBtns = element.querySelectorAll('a');
    for (const btn of actionBtns) {
      const onclick = btn.getAttribute('onclick') || '';
      const match = onclick.match(/steam:\/\/rungame\/730\/[^'"]+/);
      if (match) return match[0];
    }
    
    return null;
  }

  // Enhanced Steam integration using global variables
  getSteamItemData(element) {
    try {
      const listingId = this.extractListingId(element);
      if (!listingId || !window.g_rgListingInfo) return null;
      
      const listingInfo = window.g_rgListingInfo[listingId];
      if (!listingInfo) return null;
      
      const asset = window.g_rgAssets?.[730]?.[2]?.[listingInfo.asset?.id];
      if (!asset) return null;
      
      // Extract inspect link from asset
      const inspectAction = asset.market_actions?.find(action => 
        action.name === 'Inspect in Game...' || action.link.includes('csgo_econ_action_preview')
      );
      
      if (inspectAction) {
        const inspectLink = inspectAction.link
          .replace('%listingid%', listingId)
          .replace('%assetid%', asset.id);
        
        return {
          listingInfo,
          asset,
          inspectLink,
          itemName: asset.name || asset.market_name,
          hasStickers: asset.descriptions?.some(desc => desc.value?.includes('Sticker'))
        };
      }
    } catch (e) {
      console.debug('Steam data extraction failed:', e);
    }
    return null;
  }

  extractListingId(element) {
    // Try multiple methods to get listing ID
    const nameElement = element.querySelector('.market_listing_item_name');
    if (nameElement?.id) {
      const match = nameElement.id.match(/listing_(\d+)_name/);
      if (match) return match[1];
    }
    
    // Try data attributes
    const listingRow = element.closest('.market_listing_row');
    if (listingRow?.id) {
      const match = listingRow.id.match(/listing_(\d+)/);
      if (match) return match[1];
    }
    
    return null;
  }

  extractInventoryInspectLink(item) {
    const actions = item.getAttribute('data-actions');
    if (!actions) return null;
    
    try {
      const actionsData = JSON.parse(actions);
      const inspectAction = actionsData.find(a => a.name?.includes('Inspect'));
      return inspectAction?.link || null;
    } catch (e) {
      return null;
    }
  }

  displayFloatInfo(element, floatData) {
    const container = this.createElement('div', 'cs2-float-container');
    
    const float = floatData.floatValue?.toFixed(this.settings.floatPrecision) || 'N/A';
    const wear = floatData.wear || 'Unknown';
    
    // Determine highlight class
    let highlightClass = '';
    if (floatData.floatValue < this.settings.lowFloatThreshold && this.settings.highlightLowFloat) {
      highlightClass = 'highlight-low';
    } else if (floatData.floatValue > this.settings.highFloatThreshold && this.settings.highlightHighFloat) {
      highlightClass = 'highlight-high';
    }
    
    // Create main float info container
    const floatInfo = this.createElement('div', `float-info ${highlightClass}`);
    
    // Create main float display
    const floatMain = this.createElement('div', 'float-main');
    floatMain.appendChild(this.createElement('span', 'label', 'Float:'));
    
    const valueSpan = this.createElement('span', 'value', float);
    valueSpan.title = floatData.floatValue?.toFixed(14) || 'N/A';
    floatMain.appendChild(valueSpan);
    floatMain.appendChild(this.createElement('span', 'wear', wear));
    
    floatInfo.appendChild(floatMain);
    
    // Add paint seed if enabled
    if (this.settings.showPaintSeed && floatData.paintSeed) {
      const patternDetail = this.createElement('div', 'float-detail');
      patternDetail.appendChild(this.createElement('span', 'label', 'Pattern:'));
      patternDetail.appendChild(this.createElement('span', 'value', floatData.paintSeed.toString()));
      floatInfo.appendChild(patternDetail);
    }
    
    // Add float rank if enabled
    if (this.settings.showFloatRank && floatData.floatRank) {
      const rankDetail = this.createElement('div', 'float-detail');
      rankDetail.appendChild(this.createElement('span', 'label', 'Rank:'));
      rankDetail.appendChild(this.createElement('span', 'value', `Top ${floatData.floatRank}%`));
      floatInfo.appendChild(rankDetail);
    }
    
    // Add visual float bar
    if (floatData.floatValue && this.settings.showFloatBar !== false) {
      const floatBar = this.createFloatBar(
        floatData.floatValue,
        floatData.min || 0,
        floatData.max || 1,
        floatData.wear || 'Unknown'
      );
      floatInfo.appendChild(floatBar);
    }
    
    // Add stickers if enabled
    if (this.settings.showStickers && floatData.stickers?.length > 0) {
      const stickersContainer = this.createElement('div', 'stickers');
      floatData.stickers.slice(0, 4).forEach(sticker => {
        const stickerDiv = this.createElement('div', 'sticker');
        stickerDiv.title = `${sticker.name || 'Sticker'} (${(sticker.wear * 100).toFixed(0)}% wear)`;
        stickerDiv.appendChild(this.createElement('span', 'wear-pct', `${(sticker.wear * 100).toFixed(0)}%`));
        stickersContainer.appendChild(stickerDiv);
      });
      floatInfo.appendChild(stickersContainer);
    }
    
    container.appendChild(floatInfo);
    
    const nameEl = element.querySelector('.market_listing_item_name, .market_listing_item_name_block');
    if (nameEl) {
      nameEl.appendChild(container);
    }
  }

  displayFloatBadge(element, floatData) {
    const badge = document.createElement('div');
    badge.className = 'cs2-float-badge';
    
    const float = floatData.floatValue?.toFixed(this.settings.floatPrecision) || 'N/A';
    let badgeClass = '';
    
    if (floatData.floatValue < 0.07) badgeClass = 'badge-fn';
    else if (floatData.floatValue < 0.15) badgeClass = 'badge-mw';
    else if (floatData.floatValue < 0.37) badgeClass = 'badge-ft';
    else if (floatData.floatValue < 0.44) badgeClass = 'badge-ww';
    else badgeClass = 'badge-bs';
    
    badge.innerHTML = `<span class="badge-content ${badgeClass}">${float}</span>`;
    badge.title = `Float: ${floatData.floatValue?.toFixed(this.settings.floatPrecision) || 'N/A'}\\nWear: ${floatData.wear || 'Unknown'}`;
    
    element.appendChild(badge);
  }

  addControls() {
    // Add float reload button to market pages
    if (window.location.pathname.includes('/market/')) {
      const header = document.querySelector('#searchResultsTable, .market_listing_table_header');
      if (header && !document.querySelector('.cs2-float-controls')) {
        const controls = document.createElement('div');
        controls.className = 'cs2-float-controls';
        controls.innerHTML = `
          <button class="cs2-btn" id="cs2-load-floats">Load All Floats</button>
          <span class="cs2-status" id="cs2-status">Ready</span>
        `;
        
        header.appendChild(controls);
        
        document.getElementById('cs2-load-floats').addEventListener('click', () => {
          this.processedItems.clear();
          this.processPage();
        });
      }
    }
  }

  setupObserver() {
    const observer = new MutationObserver(() => {
      // Debounce to avoid too many calls
      clearTimeout(this.observerTimeout);
      this.observerTimeout = setTimeout(() => {
        if (this.settings.autoLoad) {
          this.processPage();
        }
      }, 500);
    });

    const target = document.querySelector('#searchResultsRows, #inventorypage730, .inventory_page');
    if (target) {
      observer.observe(target, {
        childList: true,
        subtree: true
      });
    }
  }

  injectStyles() {
    if (document.getElementById('cs2-float-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'cs2-float-styles';
    style.textContent = `
      .cs2-float-container {
        margin-top: 8px;
        font-size: 12px;
      }
      
      .float-info {
        background: #2a5298;
        color: white;
        padding: 8px;
        border-radius: 4px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
      }
      
      .float-info.highlight-low {
        background: #00b09b;
        animation: pulse 2s infinite;
      }
      
      .float-info.highlight-high {
        background: #fc4a1a;
      }
      
      .float-main {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 4px;
      }
      
      .float-detail {
        display: flex;
        gap: 4px;
        font-size: 11px;
        opacity: 0.9;
      }
      
      .label {
        color: #b8d4ff;
        font-weight: 500;
      }
      
      .value {
        color: white;
        font-family: 'Courier New', monospace;
        font-weight: bold;
      }
      
      .wear {
        background: rgba(0,0,0,0.3);
        padding: 2px 6px;
        border-radius: 3px;
        font-size: 10px;
        color: #ffd700;
      }
      
      .stickers {
        display: flex;
        gap: 4px;
        margin-top: 4px;
      }
      
      .sticker {
        width: 20px;
        height: 20px;
        background: #667eea;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 9px;
        color: white;
        font-weight: bold;
      }
      
      .cs2-float-badge {
        position: absolute;
        top: 4px;
        right: 4px;
        z-index: 10;
      }
      
      .badge-content {
        background: #667eea;
        color: white;
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 10px;
        font-weight: bold;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      }
      
      .badge-fn { background: #11998e; }
      .badge-mw { background: #4facfe; }
      .badge-ft { background: #fa709a; }
      .badge-ww { background: #f093fb; }
      .badge-bs { background: #ff6b6b; }
      
      .cs2-float-controls {
        margin: 10px 0;
        padding: 10px;
        background: #f5f5f5;
        border-radius: 4px;
        display: flex;
        align-items: center;
        gap: 10px;
      }
      
      .cs2-btn {
        background: #667eea;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 4px;
        cursor: pointer;
        font-weight: 500;
        transition: transform 0.2s;
      }
      
      .cs2-btn:hover {
        transform: translateY(-1px);
      }
      
      .cs2-status {
        color: #666;
        font-size: 12px;
      }
      
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.8; }
      }
      
      .cs2-toast {
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #11998e;
        color: white;
        padding: 12px 20px;
        border-radius: 6px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 100000;
        font-size: 14px;
        font-weight: 500;
        transform: translateX(100%);
        transition: transform 0.3s ease;
      }
      
      .cs2-toast.show {
        transform: translateX(0);
      }
      
      .cs2-enhancement {
        position: absolute;
        top: 8px;
        left: 8px;
        z-index: 10;
      }
      
      .enhancement-badge {
        background: #ff6b6b;
        color: #1a1a1a;
        padding: 4px 8px;
        border-radius: 6px;
        font-size: 10px;
        font-weight: bold;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
      }
      
      .cs2-generic-float {
        position: absolute;
        top: 8px;
        right: 8px;
        z-index: 10;
      }
      
      .generic-float-badge {
        background: rgba(0, 0, 0, 0.8);
        backdrop-filter: blur(4px);
        border-radius: 6px;
        padding: 6px 8px;
        font-size: 11px;
        color: white;
        border: 1px solid rgba(255, 255, 255, 0.2);
      }
      
      .float-main-line {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 2px;
      }
      
      .float-val {
        font-family: 'Courier New', monospace;
        font-weight: bold;
        color: #00ff87;
      }
      
      .wear-badge {
        background: rgba(255, 255, 255, 0.2);
        padding: 1px 4px;
        border-radius: 3px;
        font-size: 9px;
      }
      
      .seed-line {
        font-size: 9px;
        opacity: 0.8;
      }
    `;
    
    document.head.appendChild(style);
  }

  showToast(message, duration = 3000) {
    const toast = document.createElement('div');
    toast.className = 'cs2-toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => toast.classList.add('show'), 100);
    
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Steam Trade History support
  async processTradeHistory() {
    if (!this.floatAPI) {
      console.error('FloatAPI not initialized');
      return;
    }
    
    console.log('Processing trade history...');
    const tradeItems = document.querySelectorAll('.trade_item, .trade_history_row');
    let processed = 0;
    
    for (const item of tradeItems) {
      if (this.processedItems.has(item)) continue;
      
      const inspectLink = this.extractInspectLink(item);
      if (inspectLink) {
        try {
          const floatData = await this.floatAPI.getItemFloat(inspectLink);
          if (floatData) {
            this.displayFloatInfo(item, floatData);
            processed++;
          }
        } catch (e) {
          console.debug('Trade history float fetch failed:', e);
        }
      }
      
      this.processedItems.add(item);
      
      // Small delay to avoid overwhelming the API
      if (processed % 3 === 0) {
        await this.delay(200);
      }
    }
    
    if (processed > 0) {
      this.showToast(`Loaded ${processed} trade history floats`);
    }
  }

  // Steam Trade Offer support
  async processTradeOffer() {
    if (!this.floatAPI) {
      console.error('FloatAPI not initialized');
      return;
    }
    
    console.log('Processing trade offer...');
    const tradeItems = document.querySelectorAll('.trade_offer_item, .item.cs2, .trade_slot .item');
    let processed = 0;
    
    for (const item of tradeItems) {
      if (this.processedItems.has(item)) continue;
      
      const inspectLink = this.extractInspectLink(item);
      if (inspectLink) {
        try {
          const floatData = await this.floatAPI.getItemFloat(inspectLink);
          if (floatData) {
            this.displayFloatInfo(item, floatData);
            processed++;
          }
        } catch (e) {
          console.debug('Trade offer float fetch failed:', e);
        }
      }
      
      this.processedItems.add(item);
      
      // Small delay to avoid overwhelming the API
      if (processed % 3 === 0) {
        await this.delay(200);
      }
    }
    
    if (processed > 0) {
      this.showToast(`Loaded ${processed} trade offer floats`);
    }
  }

  // Enhanced inventory inspect link extraction for Steam
  extractInventoryInspectLink(item) {
    // Try Steam's inventory data attributes first
    const actions = item.getAttribute('data-actions');
    if (actions) {
      try {
        const actionsData = JSON.parse(actions);
        const inspectAction = actionsData.find(a => a.name?.includes('Inspect'));
        if (inspectAction?.link) {
          return inspectAction.link;
        }
      } catch (e) {
        console.debug('Failed to parse inventory actions:', e);
      }
    }
    
    // Fallback to Steam's global inventory data
    const itemId = item.getAttribute('data-item') || item.id;
    if (itemId && window.g_ActiveInventory) {
      const asset = window.g_ActiveInventory.m_rgAssets[itemId]?.description;
      if (asset?.actions) {
        const inspectAction = asset.actions.find(a => a.name?.includes('Inspect'));
        return inspectAction?.link || null;
      }
    }
    
    return this.extractInspectLink(item);
  }

  getWearFromFloat(floatValue) {
    if (floatValue < 0.07) return 'Factory New';
    if (floatValue < 0.15) return 'Minimal Wear';
    if (floatValue < 0.37) return 'Field-Tested';
    if (floatValue < 0.44) return 'Well-Worn';
    return 'Battle-Scarred';
  }

  enhanceCSFloatItem(element, floatData) {
    // Add enhancement badge to CSFloat items
    if (element.querySelector('.cs2-enhancement')) return;
    
    const enhancement = document.createElement('div');
    enhancement.className = 'cs2-enhancement';
    enhancement.innerHTML = `
      <div class="enhancement-badge">
        <span>✨ ${floatData.floatRank ? `Top ${floatData.floatRank}%` : 'Enhanced'}</span>
      </div>
    `;
    
    element.style.position = 'relative';
    element.appendChild(enhancement);
  }

  displayGenericFloatBadge(element, floatData) {
    if (element.querySelector('.cs2-generic-float')) return;
    
    const badge = document.createElement('div');
    badge.className = 'cs2-generic-float';
    
    const float = floatData.floatValue?.toFixed(this.settings.floatPrecision) || 'N/A';
    const wear = floatData.wear || 'Unknown';
    
    badge.innerHTML = `
      <div class="generic-float-badge">
        <div class="float-main-line">
          <span class="float-val">${float}</span>
          <span class="wear-badge">${wear}</span>
        </div>
        ${floatData.paintSeed ? `<div class="seed-line">Pattern: ${floatData.paintSeed}</div>` : ''}
      </div>
    `;
    
    element.style.position = 'relative';
    element.appendChild(badge);
  }

  handleMessage(request, sender, sendResponse) {
    try {
      if (request.action === 'updateSettings') {
        this.settings = { ...this.settings, ...request.settings };
        sendResponse({ success: true });
        return true;
      } else if (request.action === 'reloadFloats') {
        this.processedItems.clear();
        this.processPage();
        sendResponse({ success: true });
        return true;
      } else if (request.action === 'checkManualFloat') {
        this.handleManualFloatCheck(request.inspectLink, sendResponse);
        return true; // Keep message channel open for async response
      }
    } catch (error) {
      console.error('Message handling error:', error);
      sendResponse({ success: false, error: error.message });
    }
    return true;
  }

  async handleManualFloatCheck(inspectLink, sendResponse) {
    try {
      if (!this.floatAPI) {
        throw new Error('FloatAPI not initialized');
      }
      
      if (!inspectLink) {
        throw new Error('No inspect link provided');
      }
      
      console.log('Manual float check for:', inspectLink);
      const floatData = await this.floatAPI.getItemFloat(inspectLink);
      
      if (floatData) {
        sendResponse({ success: true, data: floatData });
      } else {
        sendResponse({ success: false, error: 'No float data received' });
      }
    } catch (error) {
      console.error('Manual float check failed:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  // Visual float bar component inspired by CSGOFloat website
  createFloatBar(floatValue, minFloat, maxFloat, wearName) {
    const container = this.createElement('div', 'cs2-float-bar-container');
    
    // Wear ranges with colors
    const wearRanges = [
      { min: 0.00, max: 0.07, color: 'var(--success-color)', name: 'Factory New' },
      { min: 0.07, max: 0.15, color: 'var(--green-color)', name: 'Minimal Wear' },
      { min: 0.15, max: 0.38, color: 'var(--warning-color)', name: 'Field-Tested' },
      { min: 0.38, max: 0.45, color: 'var(--orange-color)', name: 'Well-Worn' },
      { min: 0.45, max: 1.00, color: 'var(--danger-color)', name: 'Battle-Scarred' }
    ];
    
    // Find current wear range
    const currentRange = wearRanges.find(range => 
      floatValue >= range.min && floatValue < range.max
    ) || wearRanges[wearRanges.length - 1];
    
    // Calculate wear range bounds (intersection of skin range and wear range)
    const wearMin = Math.max(currentRange.min, minFloat);
    const wearMax = Math.min(currentRange.max, maxFloat);
    
    // Calculate position within the wear range
    const position = ((floatValue - wearMin) / (wearMax - wearMin)) * 100;
    
    // Create progress bar background
    const progressBar = this.createElement('div', 'cs2-progress-bar');
    progressBar.style.background = currentRange.color;
    progressBar.style.position = 'relative';
    progressBar.style.height = '8px';
    progressBar.style.borderRadius = '4px';
    progressBar.style.marginTop = '4px';
    
    // Add wear name overlay
    const wearLabel = this.createElement('div', 'cs2-wear-label');
    wearLabel.textContent = wearName;
    wearLabel.style.position = 'absolute';
    wearLabel.style.top = '50%';
    wearLabel.style.left = '50%';
    wearLabel.style.transform = 'translate(-50%, -50%)';
    wearLabel.style.fontSize = '10px';
    wearLabel.style.fontWeight = 'bold';
    wearLabel.style.color = 'white';
    wearLabel.style.textShadow = '1px 1px 2px rgba(0,0,0,0.7)';
    wearLabel.style.whiteSpace = 'nowrap';
    progressBar.appendChild(wearLabel);
    
    // Create float marker
    const marker = this.createElement('div', 'cs2-float-marker');
    marker.style.position = 'absolute';
    marker.style.top = '-3px';
    marker.style.left = `${Math.max(0, Math.min(100, position))}%`;
    marker.style.width = '3px';
    marker.style.height = '14px';
    marker.style.background = '#ff0000';
    marker.style.borderRadius = '2px';
    marker.style.transform = 'translateX(-50%)';
    marker.title = `${floatValue.toFixed(this.settings.floatPrecision)} (${position.toFixed(1)}% within ${wearName} range)`;
    
    // Create range labels
    const leftLabel = this.createElement('div', 'cs2-range-label');
    leftLabel.textContent = wearMin.toFixed(2);
    leftLabel.style.position = 'absolute';
    leftLabel.style.top = '12px';
    leftLabel.style.left = '0';
    leftLabel.style.fontSize = '9px';
    leftLabel.style.color = 'var(--text-muted)';
    
    const rightLabel = this.createElement('div', 'cs2-range-label');
    rightLabel.textContent = wearMax.toFixed(2);
    rightLabel.style.position = 'absolute';
    rightLabel.style.top = '12px';
    rightLabel.style.right = '0';
    rightLabel.style.fontSize = '9px';
    rightLabel.style.color = 'var(--text-muted)';
    
    // Assemble the component
    container.style.position = 'relative';
    container.style.marginTop = '6px';
    container.appendChild(progressBar);
    container.appendChild(marker);
    container.appendChild(leftLabel);
    container.appendChild(rightLabel);
    
    return container;
  }

  // Utility method for creating elements with classes and text
  createElement(tagName, className = '', textContent = '') {
    const element = document.createElement(tagName);
    if (className) element.className = className;
    if (textContent) element.textContent = textContent;
    return element;
  }
}

// Initialize when page is ready
const initFloatChecker = async () => {
  console.log('Initializing CS2 Float Checker...');
  
  // Check if FloatAPI is already loaded
  if (window.FloatAPI) {
    console.log('FloatAPI already loaded, initializing...');
    new SimpleCS2FloatChecker();
    return;
  }
  
  try {
    // Load FloatAPI script with better error handling
    console.log('Loading FloatAPI script...');
    await loadScript(chrome.runtime.getURL('src/floatAPI.js'));
    
    // Wait a bit for FloatAPI to initialize
    let attempts = 0;
    while (!window.FloatAPI && attempts < 10) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }
    
    if (window.FloatAPI) {
      console.log('FloatAPI loaded successfully, initializing checker...');
      new SimpleCS2FloatChecker();
    } else {
      console.error('FloatAPI failed to initialize after loading');
    }
  } catch (error) {
    console.error('Failed to load FloatAPI:', error);
  }
};

// Helper function to load script with Promise
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    
    script.onload = () => {
      console.log('FloatAPI script loaded');
      resolve();
    };
    
    script.onerror = (error) => {
      console.error('Failed to load script:', src, error);
      reject(new Error('Script loading failed'));
    };
    
    document.head.appendChild(script);
  });
}

// Wait for DOM and extension context
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initFloatChecker, 100);
  });
} else {
  setTimeout(initFloatChecker, 100);
}