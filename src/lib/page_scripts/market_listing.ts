/**
 * Market Listing Page Script
 * Handles Steam Community Market page enhancement
 */

export class MarketListingProcessor {
  private processedListings = new Set<string>();

  async init() {
    console.log('Market listing processor initialized');
    this.processExistingListings();
    this.observeNewListings();
  }

  private processExistingListings() {
    const listings = document.querySelectorAll('.market_listing_row');
    listings.forEach(listing => this.processListing(listing as HTMLElement));
  }

  private observeNewListings() {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element;
            if (element.classList?.contains('market_listing_row')) {
              this.processListing(element as HTMLElement);
            }
          }
        });
      });
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  private async processListing(listing: HTMLElement) {
    const listingId = listing.id || `listing_${Date.now()}`;
    
    if (this.processedListings.has(listingId)) return;
    this.processedListings.add(listingId);

    // Extract inspect link and process
    const inspectLink = this.extractInspectLink(listing);
    if (inspectLink) {
      // Send message to content script for processing
      window.postMessage({
        type: 'PROCESS_MARKET_LISTING',
        data: { listingId, inspectLink }
      }, '*');
    }
  }

  private extractInspectLink(element: HTMLElement): string | null {
    const selectors = [
      'a[href*="steam://rungame/730"]',
      '*[onclick*="steam://rungame/730"]'
    ];

    for (const selector of selectors) {
      const linkElement = element.querySelector(selector);
      if (linkElement) {
        const href = linkElement.getAttribute('href') || 
                     linkElement.getAttribute('onclick');
        
        if (href) {
          const match = href.match(/steam:\/\/rungame\/730\/[^'"\\s]+/);
          if (match) return match[0];
        }
      }
    }

    return null;
  }
}

// Auto-initialize if on market page
if (window.location.href.includes('steamcommunity.com/market/listings/730/')) {
  const processor = new MarketListingProcessor();
  processor.init();
}