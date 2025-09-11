/**
 * Enhanced Popup Script
 */

interface ExtensionStats {
  itemsAnalyzed: number;
  blueGemsDetected: number;
  topTierFloatsFound: number;
  totalValueAnalyzed: number;
  extensionVersion: string;
}

class PopupManager {
  private stats: ExtensionStats = {
    itemsAnalyzed: 0,
    blueGemsDetected: 0,
    topTierFloatsFound: 0,
    totalValueAnalyzed: 0,
    extensionVersion: '2.0.0'
  };

  async init() {
    await this.loadStats();
    this.setupUI();
    this.updateDisplay();
  }

  private async loadStats() {
    try {
      const result = await chrome.storage.local.get(['enhancedStats']);
      this.stats = { ...this.stats, ...result.enhancedStats };
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  }

  private setupUI() {
    const container = document.getElementById('popup-container');
    if (!container) return;

    container.innerHTML = `
      <div class="header">
        <h2>CS2 Float Enhanced</h2>
        <div class="version">v${this.stats.extensionVersion}</div>
      </div>
      
      <div class="stats-section">
        <h3>Statistics</h3>
        <div class="stat-item">
          <span class="stat-label">Items Analyzed:</span>
          <span class="stat-value" id="items-analyzed">${this.stats.itemsAnalyzed}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Blue Gems Found:</span>
          <span class="stat-value" id="blue-gems">${this.stats.blueGemsDetected}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Top Tier Floats:</span>
          <span class="stat-value" id="top-floats">${this.stats.topTierFloatsFound}</span>
        </div>
      </div>
      
      <div class="actions">
        <button id="clear-cache">Clear Cache</button>
        <button id="open-settings">Settings</button>
      </div>
    `;

    this.bindEvents();
  }

  private bindEvents() {
    const clearCacheBtn = document.getElementById('clear-cache');
    const openSettingsBtn = document.getElementById('open-settings');

    clearCacheBtn?.addEventListener('click', () => this.clearCache());
    openSettingsBtn?.addEventListener('click', () => this.openSettings());
  }

  private updateDisplay() {
    const elements = {
      'items-analyzed': this.stats.itemsAnalyzed,
      'blue-gems': this.stats.blueGemsDetected,
      'top-floats': this.stats.topTierFloatsFound
    };

    Object.entries(elements).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (element) element.textContent = value.toString();
    });
  }

  private async clearCache() {
    try {
      await chrome.runtime.sendMessage({ action: 'clearCache' });
      // Show success message
      this.showMessage('Cache cleared successfully!');
    } catch (error) {
      this.showMessage('Failed to clear cache', 'error');
    }
  }

  private openSettings() {
    chrome.tabs.create({
      url: chrome.runtime.getURL('settings.html')
    });
  }

  private showMessage(text: string, type: 'success' | 'error' = 'success') {
    const messageEl = document.createElement('div');
    messageEl.className = `message ${type}`;
    messageEl.textContent = text;
    
    document.body.appendChild(messageEl);
    
    setTimeout(() => {
      messageEl.remove();
    }, 3000);
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const popup = new PopupManager();
  popup.init();
});