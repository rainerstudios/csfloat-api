/**
 * Content Manager - Main orchestrator for CS2 Float Extension
 * Coordinates all components and manages the overall extension lifecycle
 */

import { generateId, sleep } from '../utils/helpers.js';
import { EXTENSION_CONFIG, TIMEOUTS } from '../utils/constants.js';

export class ContentManager {
    constructor() {
        this.version = EXTENSION_CONFIG.VERSION;
        this.initialized = false;
        this.settings = {};
        this.components = new Map();
        this.messageHandlers = new Map();
        
        // Initialize logging
        this.log('ContentManager initialized');
    }
    
    /**
     * Logging utility
     * @param {...any} args - Arguments to log
     */
    log(...args) {
        console.log(`[CS2 Float Checker v${this.version}]`, ...args);
    }
    
    /**
     * Initialize the content manager
     */
    async init() {
        if (this.initialized) {
            this.log('Already initialized, skipping...');
            return;
        }
        
        this.log('Initializing Content Manager...');
        this.log('Current URL:', window.location.href);
        this.log('Document ready state:', document.readyState);
        
        try {
            // Setup core functionality
            this.setupMessageListener();
            this.loadDefaultSettings();
            
            // Wait for DOM if needed
            if (document.readyState === 'loading') {
                this.log('Document still loading, waiting for DOMContentLoaded...');
                await new Promise(resolve => {
                    document.addEventListener('DOMContentLoaded', resolve);
                });
            }
            
            // Load and initialize components
            await this.loadComponents();
            await this.setupPageHandlers();
            
            this.initialized = true;
            this.log('✅ Content Manager initialization complete');
            
        } catch (error) {
            this.log('❌ Content Manager initialization failed:', error);
        }
    }
    
    /**
     * Setup message listener for communication with background script and popup
     */
    setupMessageListener() {
        this.log('Setting up message listeners...');
        
        // Listen for messages from popup/background
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            this.handleChromeMessage(request, sender, sendResponse);
        });
        
        // Listen for window messages from injected scripts
        window.addEventListener('message', (event) => {
            this.handleWindowMessage(event);
        });
        
        this.log('✅ Message listeners setup complete');
    }
    
    /**
     * Handle Chrome extension messages
     * @param {Object} request - Message request
     * @param {Object} sender - Message sender
     * @param {Function} sendResponse - Response callback
     */
    async handleChromeMessage(request, sender, sendResponse) {
        try {
            switch (request.action) {
                case 'updateSettings':
                    this.log('🔄 Received settings update:', request.settings);
                    await this.updateSettings(request.settings);
                    sendResponse({ success: true });
                    break;
                    
                case 'reloadFloats':
                    this.log('🔄 Received reload floats request');
                    await this.reloadFloats();
                    sendResponse({ success: true });
                    break;
                    
                case 'getStatus':
                    sendResponse({
                        success: true,
                        status: {
                            initialized: this.initialized,
                            version: this.version,
                            components: Array.from(this.components.keys()),
                            settings: this.settings
                        }
                    });
                    break;
                    
                default:
                    this.log('Unknown Chrome message action:', request.action);
                    sendResponse({ success: false, error: 'Unknown action' });
            }
        } catch (error) {
            this.log('❌ Error handling Chrome message:', error);
            sendResponse({ success: false, error: error.message });
        }
    }
    
    /**
     * Handle window messages from injected scripts
     * @param {MessageEvent} event - Message event
     */
    async handleWindowMessage(event) {
        // Only accept messages from same origin
        if (event.origin !== window.location.origin) {
            return;
        }
        
        try {
            switch (event.data?.type) {
                case 'CS2_FETCH_FLOAT_REQUEST':
                    await this.handleFloatRequest(event.data.payload);
                    break;
                    
                case 'CS2_COMPONENT_READY':
                    this.handleComponentReady(event.data.payload);
                    break;
                    
                default:
                    // Ignore unknown message types
                    break;
            }
        } catch (error) {
            this.log('❌ Error handling window message:', error);
        }
    }
    
    /**
     * Handle float data request from injected scripts
     * @param {Object} payload - Request payload
     */
    async handleFloatRequest(payload) {
        this.log('📨 Received float request:', payload);
        
        try {
            // Forward request to background script
            const response = await chrome.runtime.sendMessage({
                action: 'fetchFloat',
                inspectLink: payload.inspectLink,
                assetId: payload.assetId
            });
            
            // Send response back to injected script
            window.postMessage({
                type: 'CS2_FETCH_FLOAT_RESPONSE',
                payload: {
                    ...response,
                    assetId: payload.assetId,
                    elementId: payload.elementId,
                    requestId: payload.requestId
                }
            }, window.location.origin);
            
        } catch (error) {
            this.log('❌ Error handling float request:', error);
            
            // Send error response
            window.postMessage({
                type: 'CS2_FETCH_FLOAT_RESPONSE',
                payload: {
                    error: error.message,
                    assetId: payload.assetId,
                    elementId: payload.elementId,
                    requestId: payload.requestId
                }
            }, window.location.origin);
        }
    }
    
    /**
     * Handle component ready notification
     * @param {Object} payload - Component payload
     */
    handleComponentReady(payload) {
        this.log('📦 Component ready:', payload.componentName);
        // Could be used for dependency management
    }
    
    /**
     * Load default settings
     */
    loadDefaultSettings() {
        this.settings = {
            enableMarket: true,
            enableInventory: true,
            enableFloatFilters: true,
            showFloatBars: true,
            showRankings: true,
            showPatterns: true,
            showProfitCalculator: true,
            showQuickBuy: true,
            floatPrecision: 4,
            enableCopyToClipboard: true
        };
    }
    
    /**
     * Update settings and restart processing
     * @param {Object} newSettings - New settings
     */
    async updateSettings(newSettings) {
        const oldSettings = { ...this.settings };
        this.settings = { ...this.settings, ...newSettings };
        
        // Notify injected scripts of settings update
        window.postMessage({
            type: 'CS2_SETTINGS_UPDATE',
            settings: this.settings
        }, window.location.origin);
        
        // Restart processing if needed
        await this.handleSettingsChange(oldSettings, this.settings);
    }
    
    /**
     * Handle settings changes and restart affected components
     * @param {Object} oldSettings - Previous settings
     * @param {Object} newSettings - New settings
     */
    async handleSettingsChange(oldSettings, newSettings) {
        this.log('🔄 Handling settings change...');
        
        // Check if page processing settings changed
        const marketChanged = oldSettings.enableMarket !== newSettings.enableMarket;
        const inventoryChanged = oldSettings.enableInventory !== newSettings.enableInventory;
        
        if (marketChanged || inventoryChanged) {
            // Clear existing displays
            this.removeAllFloats();
            
            // Restart processors
            const processors = this.getActiveProcessors();
            for (const processor of processors) {
                if (processor.restart) {
                    await processor.restart();
                }
            }
        }
        
        // Notify other components of settings change
        this.broadcastToComponents('settingsChanged', newSettings);
    }
    
    /**
     * Load and initialize components
     */
    async loadComponents() {
        this.log('Loading components...');
        
        const componentModules = [
            { name: 'PageDetector', path: '../detectors/PageDetector.js' },
            { name: 'MarketProcessor', path: '../processors/MarketProcessor.js' },
            { name: 'InventoryProcessor', path: '../processors/InventoryProcessor.js' },
            { name: 'FloatDisplay', path: '../components/display/FloatDisplay.js' }
        ];
        
        for (const module of componentModules) {
            try {
                const { [module.name]: ComponentClass } = await import(module.path);
                const instance = new ComponentClass({
                    contentManager: this,
                    settings: this.settings
                });
                
                this.components.set(module.name, instance);
                this.log(`✅ ${module.name} loaded`);
                
            } catch (error) {
                this.log(`❌ Failed to load ${module.name}:`, error);
            }
        }
        
        // Initialize loaded components
        for (const [name, component] of this.components) {
            if (component.init && typeof component.init === 'function') {
                try {
                    await component.init();
                    this.log(`✅ ${name} initialized`);
                } catch (error) {
                    this.log(`❌ Failed to initialize ${name}:`, error);
                }
            }
        }
    }
    
    /**
     * Setup page-specific handlers
     */
    async setupPageHandlers() {
        const pageDetector = this.components.get('PageDetector');
        if (!pageDetector) {
            this.log('⚠️ PageDetector not available');
            return;
        }
        
        const pageType = pageDetector.getPageType();
        this.log(`Page type detected: ${pageType}`);
        
        // Start appropriate processors
        switch (pageType) {
            case 'market-listing':
                if (this.settings.enableMarket) {
                    const marketProcessor = this.components.get('MarketProcessor');
                    if (marketProcessor) {
                        await marketProcessor.start();
                    }
                }
                break;
                
            case 'inventory':
                if (this.settings.enableInventory) {
                    const inventoryProcessor = this.components.get('InventoryProcessor');
                    if (inventoryProcessor) {
                        await inventoryProcessor.start();
                    }
                }
                break;
                
            default:
                this.log(`No specific handler for page type: ${pageType}`);
        }
    }
    
    /**
     * Reload all float displays
     */
    async reloadFloats() {
        this.log('🔄 Reloading all floats...');
        
        // Clear existing displays
        this.removeAllFloats();
        
        // Restart processors
        const processors = this.getActiveProcessors();
        for (const processor of processors) {
            if (processor.reload) {
                await processor.reload();
            }
        }
        
        // Notify injected scripts
        window.postMessage({
            type: 'CS2_RELOAD_FLOATS'
        }, window.location.origin);
    }
    
    /**
     * Remove all float displays from the page
     */
    removeAllFloats() {
        const selectors = [
            '[data-cs2float-display]',
            '.cs2-float-value',
            '.cs2-float-tooltip',
            '.cs2-float-bar-container',
            '.cs2-float-ranking',
            '.cs2-pattern-display'
        ];
        
        let removedCount = 0;
        selectors.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(el => {
                el.remove();
                removedCount++;
            });
        });
        
        this.log(`Removed ${removedCount} float displays`);
    }
    
    /**
     * Get currently active processors
     * @returns {Array} Array of active processors
     */
    getActiveProcessors() {
        const processors = [];
        
        if (this.settings.enableMarket) {
            const marketProcessor = this.components.get('MarketProcessor');
            if (marketProcessor) processors.push(marketProcessor);
        }
        
        if (this.settings.enableInventory) {
            const inventoryProcessor = this.components.get('InventoryProcessor');
            if (inventoryProcessor) processors.push(inventoryProcessor);
        }
        
        return processors;
    }
    
    /**
     * Broadcast message to all components
     * @param {string} eventType - Event type
     * @param {any} data - Event data
     */
    broadcastToComponents(eventType, data) {
        for (const [name, component] of this.components) {
            if (component.handleEvent && typeof component.handleEvent === 'function') {
                try {
                    component.handleEvent(eventType, data);
                } catch (error) {
                    this.log(`❌ Error broadcasting to ${name}:`, error);
                }
            }
        }
    }
    
    /**
     * Get component by name
     * @param {string} name - Component name
     * @returns {Object|null} Component instance
     */
    getComponent(name) {
        return this.components.get(name) || null;
    }
    
    /**
     * Destroy the content manager and all components
     */
    destroy() {
        this.log('Destroying Content Manager...');
        
        // Destroy all components
        for (const [name, component] of this.components) {
            if (component.destroy && typeof component.destroy === 'function') {
                try {
                    component.destroy();
                    this.log(`✅ ${name} destroyed`);
                } catch (error) {
                    this.log(`❌ Error destroying ${name}:`, error);
                }
            }
        }
        
        // Clear collections
        this.components.clear();
        this.messageHandlers.clear();
        
        // Remove all float displays
        this.removeAllFloats();
        
        this.initialized = false;
        this.log('✅ Content Manager destroyed');
    }
}