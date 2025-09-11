/**
 * Inventory Page Script
 * Handles Steam Community Inventory page enhancement
 */

export class InventoryProcessor {
  private processedItems = new Set<string>();

  async init() {
    console.log('Inventory processor initialized');
    await this.waitForInventory();
    this.processInventoryItems();
    this.setupClickHandlers();
  }

  private async waitForInventory(): Promise<void> {
    return new Promise((resolve) => {
      const check = () => {
        if (typeof (window as any).g_ActiveInventory !== 'undefined') {
          resolve();
        } else {
          setTimeout(check, 500);
        }
      };
      check();
    });
  }

  private processInventoryItems() {
    const items = document.querySelectorAll('.item.app730.context2');
    items.forEach(item => this.processItem(item as HTMLElement));
  }

  private setupClickHandlers() {
    document.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      const item = target.closest('.item.app730.context2');
      
      if (item) {
        setTimeout(() => {
          this.extractFloatFromUI(item as HTMLElement);
        }, 500);
      }
    });
  }

  private processItem(item: HTMLElement) {
    const itemId = item.id;
    
    if (!itemId || this.processedItems.has(itemId)) return;
    this.processedItems.add(itemId);

    // Send message to content script for processing
    window.postMessage({
      type: 'PROCESS_INVENTORY_ITEM',
      data: { itemId }
    }, '*');
  }

  private extractFloatFromUI(item: HTMLElement) {
    // Extract float from Steam's item info panels
    for (let i = 0; i <= 1; i++) {
      const itemInfo = document.getElementById(`iteminfo${i}`);
      if (itemInfo && itemInfo.style.opacity === '1') {
        const floatData = this.parseItemInfo(itemInfo);
        if (floatData) {
          window.postMessage({
            type: 'INVENTORY_FLOAT_EXTRACTED',
            data: { itemId: item.id, floatData }
          }, '*');
          break;
        }
      }
    }
  }

  private parseItemInfo(itemInfo: HTMLElement): any {
    const assetProps = itemInfo.querySelector('#' + itemInfo.id + '_item_asset_properties_content');
    if (!assetProps?.textContent) return null;

    const text = assetProps.textContent;
    const floatMatch = text.match(/Wear Rating:\s*([\d.]+)/);
    const seedMatch = text.match(/Pattern Template:\s*(\d+)/);

    if (floatMatch) {
      return {
        float: parseFloat(floatMatch[1]),
        paintSeed: seedMatch ? parseInt(seedMatch[1]) : null
      };
    }

    return null;
  }
}

// Auto-initialize if on inventory page
if (window.location.href.includes('/inventory/')) {
  const processor = new InventoryProcessor();
  processor.init();
}