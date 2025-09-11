/**
 * Enhanced Content Script
 * Integrates all new features and provides rich float analysis
 */

// Temporarily disable imports to fix build issues
// import { EnhancedFloatData } from './types/float_data';
// import { FloatBarComponent } from './lib/components/float_bar';

// Basic type definitions
interface EnhancedFloatData {
  floatValue: number;
  paintSeed: number;
  wearName: string;
  weaponName: string;
  skinName: string;
  fullItemName: string;
  floatPercentile?: number;
  blueGemInfo?: any;
  patternInfo?: any;
  marketTrends?: any[];
  statTrakKills?: number;
  investmentScore?: number;
  steamPrice?: number;
  stickers: any[];
  keychains: any[];
}

// Enhanced content manager
class EnhancedContentManager {
  private initialized = false;
  private processedItems = new Set<string>();
  private activeFloatBars = new Map<string, any>();
  private settings: any = {};

  constructor() {
    this.init();
  }

  async init() {
    if (this.initialized) return;
    
    console.log('🚀 Initializing CS2 Float Extension Enhanced');
    
    try {
      // Load settings
      await this.loadSettings();
      
      // Set up page detection and processing
      this.setupPageHandlers();
      
      // Initialize based on current page
      this.detectAndProcessPage();
      
      this.initialized = true;
      console.log('✅ Enhanced extension initialized successfully');
      
    } catch (error) {
      console.error('❌ Enhanced extension initialization failed:', error);
    }
  }

  private async loadSettings() {
    const result = await chrome.storage.local.get(['settings']);
    this.settings = result.settings || {};
    
    // Set defaults for enhanced features
    this.settings = {
      enablePatternAnalysis: true,
      enableBlueGemDetection: true,
      enableMarketIntelligence: true,
      enableVisualFloatBars: true,
      enableAdvancedTooltips: true,
      showPercentileRank: true,
      showPatternInfo: true,
      showMarketTrends: true,
      floatPrecision: 6,
      ...this.settings
    };
  }

  private setupPageHandlers() {
    // Handle page navigation
    let lastUrl = location.href;
    new MutationObserver(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        setTimeout(() => this.detectAndProcessPage(), 1000);
      }
    }).observe(document, { subtree: true, childList: true });
    
    // Handle dynamic content
    new MutationObserver((mutations) => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            this.processNewElements(node as Element);
          }
        });
      });
    }).observe(document.body, { childList: true, subtree: true });
  }

  private detectAndProcessPage() {
    const url = window.location.href;
    
    if (url.includes('steamcommunity.com/market/listings/730/')) {
      this.processMarketPage();
    } else if (url.includes('steamcommunity.com/profiles/') && url.includes('/inventory/')) {
      this.processInventoryPage();
    } else if (url.includes('steamcommunity.com/tradeoffer/')) {
      this.processTradeOfferPage();
    }
  }

  private async processMarketPage() {
    console.log('📊 Processing market page with enhanced features');
    
    // Find market listings
    const listings = document.querySelectorAll('.market_listing_row');
    
    for (const listing of listings) {
      await this.processMarketListing(listing as HTMLElement);
    }
  }

  private async processMarketListing(listing: HTMLElement) {
    const listingId = listing.id || `listing_${Date.now()}_${Math.random()}`;
    
    if (this.processedItems.has(listingId)) return;
    
    try {
      // Extract inspect link
      const inspectLink = this.extractInspectLink(listing);
      if (!inspectLink) return;
      
      // Mark as processing
      this.processedItems.add(listingId);
      
      // Show loading indicator
      const loadingIndicator = this.createLoadingIndicator();
      const priceElement = listing.querySelector('.market_listing_price');
      if (priceElement) {
        priceElement.appendChild(loadingIndicator);
      }
      
      // Fetch enhanced float data
      const enhancedData = await this.fetchEnhancedFloatData(inspectLink, 'high');
      
      if (enhancedData) {
        // Remove loading indicator
        loadingIndicator.remove();
        
        // Create enhanced display
        await this.createEnhancedDisplay(listing, enhancedData, 'market');
      }
      
    } catch (error) {
      console.error('Market listing processing error:', error);
    }
  }

  private async processInventoryPage() {
    console.log('🎒 Processing inventory page with enhanced features');
    
    // Wait for Steam inventory to load
    await this.waitForInventoryLoad();
    
    // Process inventory items
    const items = document.querySelectorAll('.item.app730.context2');
    
    for (const item of items) {
      await this.processInventoryItem(item as HTMLElement);
    }
  }

  private async processInventoryItem(item: HTMLElement) {
    const itemId = item.id;
    
    if (!itemId || this.processedItems.has(itemId)) return;
    
    try {
      // Use Steam's item click to extract float data
      await this.extractInventoryFloat(item);
      
    } catch (error) {
      console.error('Inventory item processing error:', error);
    }
  }

  private async extractInventoryFloat(item: HTMLElement) {
    // Simulate click to load item info
    const clickEvent = new MouseEvent('click', { bubbles: true });
    item.dispatchEvent(clickEvent);
    
    // Wait for Steam to load item info
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Extract float from Steam's item info panel
    const floatData = this.extractFloatFromSteamUI();
    
    if (floatData) {
      this.processedItems.add(item.id);
      
      // Get additional data from API for enhanced analysis
      const inspectLink = this.generateInspectLink(item);
      if (inspectLink) {
        const enhancedData = await this.fetchEnhancedFloatData(inspectLink, 'normal');
        if (enhancedData) {
          await this.createEnhancedDisplay(item, enhancedData, 'inventory');
        }
      }
    }
  }

  private extractFloatFromSteamUI(): any {
    // Extract float from Steam's item info panels
    for (let i = 0; i <= 1; i++) {
      const itemInfo = document.getElementById(`iteminfo${i}`);
      if (itemInfo && itemInfo.style.opacity === '1') {
        const assetProps = document.getElementById(`${itemInfo.id}_item_asset_properties_content`);
        if (assetProps?.textContent) {
          const text = assetProps.textContent;
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
  }

  private async processTradeOfferPage() {
    console.log('🔄 Processing trade offer page with enhanced features');
    
    // Process items in trade offer
    const tradeItems = document.querySelectorAll('.trade_item');
    
    for (const item of tradeItems) {
      await this.processTradeItem(item as HTMLElement);
    }
  }

  private async processTradeItem(item: HTMLElement) {
    // Similar to inventory processing but for trade items
    const inspectLink = this.extractInspectLink(item);
    if (inspectLink && !this.processedItems.has(inspectLink)) {
      this.processedItems.add(inspectLink);
      
      const enhancedData = await this.fetchEnhancedFloatData(inspectLink, 'high');
      if (enhancedData) {
        await this.createEnhancedDisplay(item, enhancedData, 'trade');
      }
    }
  }

  private async fetchEnhancedFloatData(inspectLink: string, priority: 'high' | 'normal' | 'low' = 'normal'): Promise<EnhancedFloatData | null> {
    try {
      const response = await new Promise<any>((resolve) => {
        chrome.runtime.sendMessage({
          action: 'fetchEnhancedFloat',
          inspectLink,
          priority
        }, resolve);
      });
      
      if (response?.enhancedData) {
        return response.enhancedData;
      }
      
      return null;
      
    } catch (error) {
      console.error('Enhanced float data fetch error:', error);
      return null;
    }
  }

  private async createEnhancedDisplay(container: HTMLElement, data: EnhancedFloatData, context: 'market' | 'inventory' | 'trade') {
    // Remove any existing displays
    container.querySelectorAll('.cs2-enhanced-float-display').forEach(el => el.remove());
    
    // Create main display container
    const displayContainer = document.createElement('div');
    displayContainer.className = 'cs2-enhanced-float-display';
    
    // Create visual float bar if enabled (simplified for build)
    if (this.settings.enableVisualFloatBars) {
      const barContainer = document.createElement('div');
      barContainer.className = 'cs2-float-bar-container';
      barContainer.innerHTML = `
        <div style="background: linear-gradient(to right, #4CAF50 7%, #8BC34A 15%, #FF9800 38%, #FF5722 45%, #795548 100%); 
                    height: 20px; border-radius: 4px; position: relative; margin: 4px 0;">
          <div style="position: absolute; left: ${data.floatValue * 100}%; top: 50%; 
                      transform: translateX(-50%) translateY(-50%); width: 8px; height: 8px; 
                      background: white; border: 1px solid black; border-radius: 50%;"></div>
        </div>
        <div style="font-size: 10px; text-align: center; color: #4CAF50;">
          Float: ${data.floatValue.toFixed(6)}
        </div>
      `;
      displayContainer.appendChild(barContainer);
    }
    
    // Create info panel
    const infoPanel = this.createInfoPanel(data, context);
    displayContainer.appendChild(infoPanel);
    
    // Create pattern info if available
    if (this.settings.showPatternInfo && data.blueGemInfo) {
      const patternInfo = this.createPatternInfo(data);
      displayContainer.appendChild(patternInfo);
    }
    
    // Create market intelligence if available and enabled
    if (this.settings.showMarketTrends && data.marketTrends && data.marketTrends.length > 0) {
      const marketInfo = this.createMarketInfo(data);
      displayContainer.appendChild(marketInfo);
    }
    
    // Position and inject the display
    this.injectDisplay(container, displayContainer, context);
  }

  private createInfoPanel(data: EnhancedFloatData, context: string): HTMLElement {
    const panel = document.createElement('div');
    panel.className = 'cs2-enhanced-info-panel';
    panel.style.cssText = `
      background: rgba(0, 0, 0, 0.9);
      color: white;
      padding: 8px;
      border-radius: 4px;
      font-size: 11px;
      margin-bottom: 4px;
    `;
    
    const infoItems = [];
    
    // Float value with precision
    infoItems.push(`<div style="margin-bottom: 4px;">
      <span style="color: #4CAF50; font-weight: bold;">Float:</span> 
      ${data.floatValue.toFixed(this.settings.floatPrecision)}
    </div>`);
    
    // Percentile ranking if available
    if (data.floatPercentile) {
      const topPercent = 100 - data.floatPercentile;
      const emoji = topPercent <= 5 ? '🏆' : topPercent <= 10 ? '⭐' : topPercent <= 25 ? '👍' : '📊';
      infoItems.push(`<div style="margin-bottom: 4px;">
        <span style="color: #8BC34A;">Ranking:</span> 
        ${emoji} Top ${topPercent.toFixed(1)}%
      </div>`);
    }
    
    // Pattern seed
    infoItems.push(`<div style="margin-bottom: 4px;">
      <span style="color: #9C27B0;">Pattern:</span> #${data.paintSeed}
    </div>`);
    
    // StatTrak kills if available
    if (data.statTrakKills !== undefined) {
      infoItems.push(`<div style="margin-bottom: 4px;">
        <span style="color: #FF6B35;">StatTrak™:</span> ${data.statTrakKills} kills
      </div>`);
    }
    
    panel.innerHTML = infoItems.join('');
    return panel;
  }

  private createPatternInfo(data: EnhancedFloatData): HTMLElement {
    const panel = document.createElement('div');
    panel.className = 'cs2-pattern-info';
    panel.style.cssText = `
      background: linear-gradient(135deg, rgba(33, 150, 243, 0.2), rgba(33, 150, 243, 0.1));
      border: 1px solid rgba(33, 150, 243, 0.3);
      color: white;
      padding: 6px;
      border-radius: 4px;
      font-size: 10px;
      margin-bottom: 4px;
    `;
    
    if (data.blueGemInfo) {
      panel.innerHTML = `
        <div style="font-weight: bold; color: #2196F3; margin-bottom: 2px;">
          🔷 Blue Gem Detected
        </div>
        <div>Blue: ${data.blueGemInfo.bluePercentage}% | ${data.blueGemInfo.tier}</div>
        ${data.blueGemInfo.estimatedValue ? `
          <div style="color: #4CAF50;">
            Value: $${data.blueGemInfo.estimatedValue.min} - $${data.blueGemInfo.estimatedValue.max}
          </div>
        ` : ''}
      `;
    }
    
    return panel;
  }

  private createMarketInfo(data: EnhancedFloatData): HTMLElement {
    const panel = document.createElement('div');
    panel.className = 'cs2-market-info';
    panel.style.cssText = `
      background: rgba(76, 175, 80, 0.1);
      border: 1px solid rgba(76, 175, 80, 0.3);
      color: white;
      padding: 6px;
      border-radius: 4px;
      font-size: 10px;
    `;
    
    const investmentColor = this.getInvestmentColor(data.investmentScore || 5);
    
    panel.innerHTML = `
      <div style="font-weight: bold; color: #4CAF50; margin-bottom: 2px;">
        📈 Market Intelligence
      </div>
      ${data.steamPrice ? `<div>Price: $${data.steamPrice}</div>` : ''}
      <div style="color: ${investmentColor};">
        Investment Score: ${data.investmentScore || 'N/A'}/10
      </div>
    `;
    
    return panel;
  }

  private getInvestmentColor(score: number): string {
    if (score >= 8) return '#4CAF50'; // Green
    if (score >= 6) return '#8BC34A'; // Light green
    if (score >= 4) return '#FF9800'; // Orange
    return '#F44336'; // Red
  }

  private injectDisplay(container: HTMLElement, display: HTMLElement, context: string) {
    switch (context) {
      case 'market':
        // Inject after price element
        const priceElement = container.querySelector('.market_listing_price');
        if (priceElement) {
          priceElement.appendChild(display);
        }
        break;
        
      case 'inventory':
        // Inject as overlay on item
        display.style.cssText += `
          position: absolute;
          bottom: 2px;
          left: 2px;
          right: 2px;
          z-index: 10;
        `;
        container.style.position = 'relative';
        container.appendChild(display);
        break;
        
      case 'trade':
        // Inject below item in trade interface
        container.appendChild(display);
        break;
    }
  }

  private extractInspectLink(element: HTMLElement): string | null {
    // Enhanced inspect link extraction
    const selectors = [
      'a[href*="steam://rungame/730"]',
      '*[onclick*="steam://rungame/730"]',
      '*[data-inspect*="steam://rungame/730"]'
    ];
    
    for (const selector of selectors) {
      const linkElement = element.querySelector(selector);
      if (linkElement) {
        const href = linkElement.getAttribute('href') || 
                     linkElement.getAttribute('onclick') || 
                     linkElement.getAttribute('data-inspect');
        
        if (href) {
          const match = href.match(/steam:\/\/rungame\/730\/[^'"\\s]+/);
          if (match) return match[0];
        }
      }
    }
    
    return null;
  }

  private generateInspectLink(item: HTMLElement): string | null {
    // Generate inspect link for inventory items
    // This would use Steam's internal data structures
    return null; // Placeholder
  }

  private createLoadingIndicator(): HTMLElement {
    const indicator = document.createElement('div');
    indicator.className = 'cs2-loading-indicator';
    indicator.style.cssText = `
      display: inline-block;
      width: 16px;
      height: 16px;
      border: 2px solid #f3f3f3;
      border-top: 2px solid #4CAF50;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-left: 8px;
    `;
    
    // Add CSS animation if not already present
    if (!document.getElementById('cs2-spinner-style')) {
      const style = document.createElement('style');
      style.id = 'cs2-spinner-style';
      style.textContent = `
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `;
      document.head.appendChild(style);
    }
    
    return indicator;
  }

  private async waitForInventoryLoad(): Promise<void> {
    return new Promise((resolve) => {
      const checkInventory = () => {
        if (typeof (window as any).g_ActiveInventory !== 'undefined' && 
            (window as any).g_ActiveInventory?.m_bFullyLoaded) {
          resolve();
        } else {
          setTimeout(checkInventory, 500);
        }
      };
      checkInventory();
    });
  }

  private processNewElements(element: Element) {
    // Process dynamically added elements
    if (element.classList?.contains('market_listing_row')) {
      this.processMarketListing(element as HTMLElement);
    } else if (element.classList?.contains('item') && element.classList?.contains('app730')) {
      this.processInventoryItem(element as HTMLElement);
    }
  }
}

// Initialize enhanced content manager
const enhancedManager = new EnhancedContentManager();

// Expose for debugging
(window as any).CS2FloatExtensionEnhanced = {
  manager: enhancedManager,
  version: '2.0.0',
  features: [
    'Enhanced Float Analysis',
    'Blue Gem Detection', 
    'Pattern Recognition',
    'Market Intelligence',
    'Visual Float Bars',
    'Advanced Tooltips'
  ]
};

console.log('🎮 CS2 Float Extension Enhanced Content Script loaded');
console.log('🔥 Features: Blue Gem Detection, Pattern Analysis, Market Intelligence');