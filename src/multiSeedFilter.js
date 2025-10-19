/**
 * Multi-Seed Blue Gem Filter
 * Search for multiple paint seeds simultaneously
 *
 * HIGH-VALUE FEATURE: Power user tool for blue gem hunters
 * User Impact: Find rare patterns across hundreds of listings instantly
 */

class MultiSeedFilter {
    constructor() {
        this.enabled = false;
        this.activeSeeds = new Set();
        this.filterMode = 'include'; // 'include' or 'exclude'

        // Preset seed collections for popular patterns
        this.presets = {
            'AK-47 Tier 1 Blue Gems': [661, 670, 955, 809, 828],
            'AK-47 Tier 2 Blue Gems': [179, 321, 387, 760, 592, 868],
            'Five-SeveN Blue Gems': [278, 189, 868, 363, 670],
            'Karambit Blue Gems': [387, 321, 661, 82],
            'Doppler Ruby/Sapphire': [415, 416, 417], // Paint indices
            'Fade High Tier': Array.from({length: 50}, (_, i) => i + 1), // Seeds 1-50
            'Marble Fade Fire & Ice': [412, 688, 25, 436, 555, 344, 750, 853, 838]
        };

        this.init();
    }

    /**
     * Initialize multi-seed filter
     */
    init() {
        console.log('[CS2 Float] Multi-Seed Filter initialized');

        // Create filter UI
        this.createFilterUI();

        // Inject CSS
        this.injectCSS();
    }

    /**
     * Create filter UI panel
     */
    createFilterUI() {
        // Check if we're on Steam Market
        if (!window.location.href.includes('steamcommunity.com/market/')) {
            return;
        }

        // Create filter panel
        const panel = document.createElement('div');
        panel.id = 'multi-seed-filter-panel';
        panel.className = 'multi-seed-panel';

        panel.innerHTML = `
            <div class="multi-seed-header">
                <div class="header-title">
                    <span class="header-icon">🔍</span>
                    <h3>Multi-Seed Filter</h3>
                </div>
                <button class="toggle-panel-btn" id="toggleSeedPanel">
                    <span class="toggle-icon">▼</span>
                </button>
            </div>

            <div class="multi-seed-content" id="seedPanelContent">
                <!-- Preset buttons -->
                <div class="presets-section">
                    <label class="section-label">Quick Presets:</label>
                    <div class="presets-grid" id="presetsGrid">
                        ${this.generatePresetButtons()}
                    </div>
                </div>

                <!-- Manual seed input -->
                <div class="manual-input-section">
                    <label class="section-label">Custom Seeds (comma-separated):</label>
                    <div class="input-row">
                        <input
                            type="text"
                            id="customSeedsInput"
                            class="seed-input"
                            placeholder="e.g., 661, 670, 955, 809"
                        />
                        <button class="add-seeds-btn" id="addCustomSeeds">Add</button>
                    </div>
                </div>

                <!-- Active seeds display -->
                <div class="active-seeds-section">
                    <div class="section-header-row">
                        <label class="section-label">Active Seeds (<span id="seedCount">0</span>):</label>
                        <button class="clear-all-btn" id="clearAllSeeds">Clear All</button>
                    </div>
                    <div class="active-seeds-list" id="activeSeedsList">
                        <div class="empty-state">No seeds selected</div>
                    </div>
                </div>

                <!-- Filter actions -->
                <div class="filter-actions">
                    <button class="action-btn primary" id="applyFilter">
                        <span class="btn-icon">✓</span>
                        Apply Filter
                    </button>
                    <button class="action-btn secondary" id="resetFilter">
                        <span class="btn-icon">↻</span>
                        Reset
                    </button>
                </div>

                <!-- Filter stats -->
                <div class="filter-stats" id="filterStats" style="display: none;">
                    <div class="stat-row">
                        <span class="stat-label">Total Items:</span>
                        <span class="stat-value" id="totalItems">0</span>
                    </div>
                    <div class="stat-row">
                        <span class="stat-label">Matching:</span>
                        <span class="stat-value highlight" id="matchingItems">0</span>
                    </div>
                    <div class="stat-row">
                        <span class="stat-label">Hidden:</span>
                        <span class="stat-value" id="hiddenItems">0</span>
                    </div>
                </div>
            </div>
        `;

        // Insert into page
        const searchResults = document.getElementById('searchResults');
        if (searchResults) {
            searchResults.parentNode.insertBefore(panel, searchResults);
        }

        // Attach event listeners
        this.attachEventListeners();
    }

    /**
     * Generate preset buttons HTML
     */
    generatePresetButtons() {
        return Object.entries(this.presets)
            .map(([name, seeds]) => `
                <button class="preset-btn" data-preset="${name}">
                    <span class="preset-name">${name}</span>
                    <span class="preset-count">${seeds.length} seeds</span>
                </button>
            `)
            .join('');
    }

    /**
     * Attach event listeners to UI elements
     */
    attachEventListeners() {
        // Toggle panel
        document.getElementById('toggleSeedPanel')?.addEventListener('click', () => {
            this.togglePanel();
        });

        // Preset buttons
        document.querySelectorAll('.preset-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const presetName = e.currentTarget.dataset.preset;
                this.loadPreset(presetName);
            });
        });

        // Add custom seeds
        document.getElementById('addCustomSeeds')?.addEventListener('click', () => {
            this.addCustomSeeds();
        });

        // Enter key in input
        document.getElementById('customSeedsInput')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.addCustomSeeds();
            }
        });

        // Clear all seeds
        document.getElementById('clearAllSeeds')?.addEventListener('click', () => {
            this.clearAllSeeds();
        });

        // Apply filter
        document.getElementById('applyFilter')?.addEventListener('click', () => {
            this.applyFilter();
        });

        // Reset filter
        document.getElementById('resetFilter')?.addEventListener('click', () => {
            this.resetFilter();
        });
    }

    /**
     * Toggle panel open/close
     */
    togglePanel() {
        const content = document.getElementById('seedPanelContent');
        const icon = document.querySelector('.toggle-icon');

        if (content.style.display === 'none') {
            content.style.display = 'block';
            icon.textContent = '▼';
        } else {
            content.style.display = 'none';
            icon.textContent = '▶';
        }
    }

    /**
     * Load a preset seed collection
     */
    loadPreset(presetName) {
        const seeds = this.presets[presetName];
        if (!seeds) return;

        // Add all seeds from preset
        seeds.forEach(seed => this.activeSeeds.add(seed));

        // Update UI
        this.updateActiveSeedsList();

        console.log(`[CS2 Float] Loaded preset: ${presetName} (${seeds.length} seeds)`);
    }

    /**
     * Add custom seeds from input
     */
    addCustomSeeds() {
        const input = document.getElementById('customSeedsInput');
        const seedsText = input.value.trim();

        if (!seedsText) return;

        // Parse comma-separated seeds
        const seeds = seedsText.split(',')
            .map(s => s.trim())
            .filter(s => s.length > 0)
            .map(s => parseInt(s, 10))
            .filter(s => !isNaN(s) && s >= 0 && s <= 1000);

        if (seeds.length === 0) {
            alert('Please enter valid paint seeds (0-1000)');
            return;
        }

        // Add to active seeds
        seeds.forEach(seed => this.activeSeeds.add(seed));

        // Clear input
        input.value = '';

        // Update UI
        this.updateActiveSeedsList();

        console.log(`[CS2 Float] Added ${seeds.length} custom seeds`);
    }

    /**
     * Update active seeds list display
     */
    updateActiveSeedsList() {
        const listContainer = document.getElementById('activeSeedsList');
        const seedCount = document.getElementById('seedCount');

        if (!listContainer || !seedCount) return;

        // Update count
        seedCount.textContent = this.activeSeeds.size;

        // Update list
        if (this.activeSeeds.size === 0) {
            listContainer.innerHTML = '<div class="empty-state">No seeds selected</div>';
            return;
        }

        // Create seed chips
        const seedsArray = Array.from(this.activeSeeds).sort((a, b) => a - b);
        listContainer.innerHTML = seedsArray.map(seed => `
            <div class="seed-chip" data-seed="${seed}">
                <span class="seed-number">#${seed}</span>
                <button class="remove-seed-btn" data-seed="${seed}">×</button>
            </div>
        `).join('');

        // Attach remove listeners
        listContainer.querySelectorAll('.remove-seed-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const seed = parseInt(e.currentTarget.dataset.seed, 10);
                this.removeSeed(seed);
            });
        });
    }

    /**
     * Remove a single seed
     */
    removeSeed(seed) {
        this.activeSeeds.delete(seed);
        this.updateActiveSeedsList();

        // If filter is active, reapply
        if (this.enabled) {
            this.applyFilter();
        }
    }

    /**
     * Clear all seeds
     */
    clearAllSeeds() {
        this.activeSeeds.clear();
        this.updateActiveSeedsList();

        // If filter is active, reset
        if (this.enabled) {
            this.resetFilter();
        }
    }

    /**
     * Apply filter to market listings
     */
    async applyFilter() {
        if (this.activeSeeds.size === 0) {
            alert('Please select at least one paint seed to filter');
            return;
        }

        this.enabled = true;
        console.log(`[CS2 Float] Applying filter with ${this.activeSeeds.size} seeds`);

        // Get all market listings
        const listings = document.querySelectorAll('.market_listing_row');
        let totalItems = 0;
        let matchingItems = 0;
        let hiddenItems = 0;

        // Show loading state
        const applyBtn = document.getElementById('applyFilter');
        const originalText = applyBtn.innerHTML;
        applyBtn.innerHTML = '<span class="loading-spinner"></span> Filtering...';
        applyBtn.disabled = true;

        for (const listing of listings) {
            totalItems++;

            // Get paint seed from listing
            const paintSeed = await this.getPaintSeedFromListing(listing);

            if (paintSeed !== null && this.activeSeeds.has(paintSeed)) {
                // Match found - show listing
                listing.style.display = '';
                listing.classList.add('seed-match');
                matchingItems++;

                // Highlight seed in listing
                this.highlightSeedInListing(listing, paintSeed);
            } else {
                // No match - hide listing
                listing.style.display = 'none';
                listing.classList.remove('seed-match');
                hiddenItems++;
            }
        }

        // Restore button
        applyBtn.innerHTML = originalText;
        applyBtn.disabled = false;

        // Update stats
        this.updateFilterStats(totalItems, matchingItems, hiddenItems);

        console.log(`[CS2 Float] Filter complete: ${matchingItems}/${totalItems} matches`);
    }

    /**
     * Get paint seed from a market listing
     */
    async getPaintSeedFromListing(listing) {
        // Check if float data already loaded
        const floatDisplay = listing.querySelector('.cs2-float-enhanced');
        if (floatDisplay) {
            const seedElement = floatDisplay.querySelector('[data-paint-seed]');
            if (seedElement) {
                return parseInt(seedElement.dataset.paintSeed, 10);
            }
        }

        // Try to get from inspect link
        const inspectBtn = listing.querySelector('a[href*="steam://rungame/730"]');
        if (!inspectBtn) {
            return null;
        }

        // Request float data if not already loaded
        try {
            const response = await chrome.runtime.sendMessage({
                action: 'fetchEnhancedFloat',
                inspectLink: inspectBtn.href
            });

            if (response && response.enhancedData && response.enhancedData.paintSeed) {
                return parseInt(response.enhancedData.paintSeed, 10);
            }
        } catch (error) {
            console.error('[CS2 Float] Error fetching paint seed:', error);
        }

        return null;
    }

    /**
     * Highlight matched seed in listing
     */
    highlightSeedInListing(listing, paintSeed) {
        // Add badge to listing
        let badge = listing.querySelector('.seed-match-badge');
        if (!badge) {
            badge = document.createElement('div');
            badge.className = 'seed-match-badge';
            listing.querySelector('.market_listing_price')?.appendChild(badge);
        }

        badge.innerHTML = `
            <span class="badge-icon">✓</span>
            <span class="badge-text">Seed #${paintSeed}</span>
        `;
    }

    /**
     * Reset filter and show all listings
     */
    resetFilter() {
        this.enabled = false;

        // Show all listings
        const listings = document.querySelectorAll('.market_listing_row');
        listings.forEach(listing => {
            listing.style.display = '';
            listing.classList.remove('seed-match');

            // Remove match badges
            const badge = listing.querySelector('.seed-match-badge');
            if (badge) {
                badge.remove();
            }
        });

        // Hide stats
        const stats = document.getElementById('filterStats');
        if (stats) {
            stats.style.display = 'none';
        }

        console.log('[CS2 Float] Filter reset');
    }

    /**
     * Update filter statistics
     */
    updateFilterStats(total, matching, hidden) {
        const stats = document.getElementById('filterStats');
        if (!stats) return;

        stats.style.display = 'block';

        document.getElementById('totalItems').textContent = total;
        document.getElementById('matchingItems').textContent = matching;
        document.getElementById('hiddenItems').textContent = hidden;
    }

    /**
     * Inject CSS styles
     */
    injectCSS() {
        if (document.getElementById('multi-seed-filter-styles')) {
            return;
        }

        const style = document.createElement('style');
        style.id = 'multi-seed-filter-styles';
        style.textContent = `
            .multi-seed-panel {
                background: linear-gradient(135deg, rgba(39, 39, 42, 0.95) 0%, rgba(24, 24, 27, 0.95) 100%);
                border: 1px solid rgba(34, 197, 94, 0.3);
                border-radius: 12px;
                padding: 20px;
                margin: 20px 0;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
            }

            .multi-seed-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 20px;
                padding-bottom: 15px;
                border-bottom: 1px solid rgba(34, 197, 94, 0.2);
            }

            .header-title {
                display: flex;
                align-items: center;
                gap: 10px;
            }

            .header-icon {
                font-size: 24px;
            }

            .multi-seed-header h3 {
                margin: 0;
                color: #22c55e;
                font-size: 18px;
                font-weight: 700;
            }

            .toggle-panel-btn {
                background: transparent;
                border: 1px solid rgba(34, 197, 94, 0.3);
                color: #22c55e;
                padding: 6px 12px;
                border-radius: 6px;
                cursor: pointer;
                transition: all 0.2s;
            }

            .toggle-panel-btn:hover {
                background: rgba(34, 197, 94, 0.1);
                border-color: #22c55e;
            }

            .section-label {
                display: block;
                color: #d4d4d8;
                font-size: 13px;
                font-weight: 600;
                margin-bottom: 8px;
            }

            .presets-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
                gap: 10px;
            }

            .preset-btn {
                background: rgba(34, 197, 94, 0.1);
                border: 1px solid rgba(34, 197, 94, 0.3);
                border-radius: 8px;
                padding: 10px;
                cursor: pointer;
                transition: all 0.2s;
                text-align: left;
            }

            .preset-btn:hover {
                background: rgba(34, 197, 94, 0.2);
                border-color: #22c55e;
                transform: translateY(-2px);
            }

            .preset-name {
                display: block;
                color: #d4d4d8;
                font-size: 12px;
                font-weight: 600;
                margin-bottom: 4px;
            }

            .preset-count {
                display: block;
                color: #a1a1aa;
                font-size: 11px;
            }

            .manual-input-section {
                margin-top: 20px;
            }

            .input-row {
                display: flex;
                gap: 10px;
            }

            .seed-input {
                flex: 1;
                background: rgba(24, 24, 27, 0.8);
                border: 1px solid rgba(161, 161, 170, 0.3);
                border-radius: 6px;
                padding: 10px 12px;
                color: #f4f4f5;
                font-size: 14px;
            }

            .seed-input:focus {
                outline: none;
                border-color: #22c55e;
                box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.1);
            }

            .add-seeds-btn {
                background: #22c55e;
                color: black;
                border: none;
                border-radius: 6px;
                padding: 10px 20px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s;
            }

            .add-seeds-btn:hover {
                background: #16a34a;
                transform: translateY(-1px);
            }

            .active-seeds-section {
                margin-top: 20px;
                padding: 15px;
                background: rgba(24, 24, 27, 0.5);
                border-radius: 8px;
            }

            .section-header-row {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 10px;
            }

            .clear-all-btn {
                background: rgba(239, 68, 68, 0.1);
                color: #ef4444;
                border: 1px solid rgba(239, 68, 68, 0.3);
                border-radius: 6px;
                padding: 4px 12px;
                font-size: 12px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s;
            }

            .clear-all-btn:hover {
                background: rgba(239, 68, 68, 0.2);
            }

            .active-seeds-list {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
                min-height: 40px;
            }

            .empty-state {
                color: #a1a1aa;
                font-size: 13px;
                font-style: italic;
            }

            .seed-chip {
                display: inline-flex;
                align-items: center;
                gap: 6px;
                background: rgba(34, 197, 94, 0.15);
                border: 1px solid rgba(34, 197, 94, 0.3);
                border-radius: 20px;
                padding: 6px 12px;
            }

            .seed-number {
                color: #22c55e;
                font-size: 13px;
                font-weight: 600;
            }

            .remove-seed-btn {
                background: transparent;
                border: none;
                color: #ef4444;
                font-size: 18px;
                line-height: 1;
                cursor: pointer;
                padding: 0;
                width: 16px;
                height: 16px;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: color 0.2s;
            }

            .remove-seed-btn:hover {
                color: #dc2626;
            }

            .filter-actions {
                display: flex;
                gap: 10px;
                margin-top: 20px;
            }

            .action-btn {
                flex: 1;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                padding: 12px 20px;
                border-radius: 8px;
                font-weight: 600;
                font-size: 14px;
                cursor: pointer;
                transition: all 0.2s;
                border: none;
            }

            .action-btn.primary {
                background: #22c55e;
                color: black;
            }

            .action-btn.primary:hover {
                background: #16a34a;
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(34, 197, 94, 0.3);
            }

            .action-btn.secondary {
                background: rgba(161, 161, 170, 0.2);
                color: #d4d4d8;
                border: 1px solid rgba(161, 161, 170, 0.3);
            }

            .action-btn.secondary:hover {
                background: rgba(161, 161, 170, 0.3);
            }

            .filter-stats {
                margin-top: 20px;
                padding: 15px;
                background: rgba(34, 197, 94, 0.1);
                border: 1px solid rgba(34, 197, 94, 0.2);
                border-radius: 8px;
            }

            .stat-row {
                display: flex;
                justify-content: space-between;
                padding: 6px 0;
            }

            .stat-label {
                color: #a1a1aa;
                font-size: 13px;
            }

            .stat-value {
                color: #d4d4d8;
                font-weight: 600;
                font-size: 14px;
            }

            .stat-value.highlight {
                color: #22c55e;
            }

            .seed-match-badge {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                background: rgba(34, 197, 94, 0.2);
                border: 1px solid rgba(34, 197, 94, 0.4);
                border-radius: 6px;
                padding: 4px 8px;
                margin-top: 6px;
                font-size: 11px;
                color: #22c55e;
                font-weight: 600;
            }

            .badge-icon {
                font-size: 12px;
            }

            .loading-spinner {
                display: inline-block;
                width: 14px;
                height: 14px;
                border: 2px solid rgba(0, 0, 0, 0.3);
                border-radius: 50%;
                border-top-color: black;
                animation: spinner-spin 0.8s linear infinite;
            }

            @keyframes spinner-spin {
                to { transform: rotate(360deg); }
            }
        `;

        document.head.appendChild(style);
    }
}

// Initialize on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.multiSeedFilter = new MultiSeedFilter();
    });
} else {
    window.multiSeedFilter = new MultiSeedFilter();
}

// Make available globally
if (typeof window !== 'undefined') {
    window.MultiSeedFilter = MultiSeedFilter;
}
