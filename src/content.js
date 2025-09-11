/**
 * CS2 Float Extension - New Modular Content Script
 * Main entry point using the new modular architecture
 */

import { ContentManager } from './core/ContentManager.js';

// Global reference to content manager
let contentManager = null;

/**
 * Initialize the extension
 */
async function initializeExtension() {
    try {
        console.log('[CS2 Float Extension] Initializing with new modular architecture...');
        
        // Check if already initialized
        if (contentManager) {
            console.log('[CS2 Float Extension] Already initialized');
            return;
        }
        
        // Create and initialize content manager
        contentManager = new ContentManager();
        await contentManager.init();
        
        console.log('[CS2 Float Extension] ✅ Initialization complete');
        
    } catch (error) {
        console.error('[CS2 Float Extension] ❌ Initialization failed:', error);
    }
}

/**
 * Handle page visibility changes
 */
function handleVisibilityChange() {
    if (document.hidden) {
        // Page is hidden, pause processing if needed
        if (contentManager) {
            console.log('[CS2 Float Extension] Page hidden, pausing...');
        }
    } else {
        // Page is visible, resume processing
        if (contentManager) {
            console.log('[CS2 Float Extension] Page visible, resuming...');
        }
    }
}

/**
 * Handle page unload
 */
function handleBeforeUnload() {
    if (contentManager) {
        console.log('[CS2 Float Extension] Cleaning up before page unload...');
        contentManager.destroy();
        contentManager = null;
    }
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
    // Handle page visibility changes
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Handle page unload
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    // Handle extension updates/reloads
    if (chrome.runtime) {
        chrome.runtime.onConnect.addListener((port) => {
            port.onDisconnect.addListener(() => {
                if (chrome.runtime.lastError) {
                    console.log('[CS2 Float Extension] Extension context invalidated, cleaning up...');
                    handleBeforeUnload();
                }
            });
        });
    }
}

/**
 * Main entry point
 */
function main() {
    console.log('[CS2 Float Extension] Content script loaded');
    console.log('[CS2 Float Extension] URL:', window.location.href);
    console.log('[CS2 Float Extension] Document ready state:', document.readyState);
    
    // Setup event listeners
    setupEventListeners();
    
    // Initialize based on document state
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeExtension);
    } else {
        // Document is already loaded
        initializeExtension();
    }
}

// Expose content manager for debugging
if (typeof window !== 'undefined') {
    window.CS2FloatExtension = {
        getContentManager: () => contentManager,
        reinitialize: async () => {
            if (contentManager) {
                contentManager.destroy();
                contentManager = null;
            }
            await initializeExtension();
        },
        getVersion: () => contentManager?.version || 'unknown'
    };
}

// Start the extension
main();