/**
 * Injector script for inventory highlighting
 * This file is loaded as a separate script to avoid CSP issues
 */

import { inventoryHighlighter } from './inventoryHighlight.js';

// Initialize highlighter
console.log('[Inventory Highlight Injector] Initializing...');
inventoryHighlighter.init().catch(console.error);

// Listen for settings updates from content script
window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'CS2_SETTINGS_UPDATE' && event.data.settings) {
        console.log('[Inventory Highlight Injector] Received settings update:', event.data.settings);
        inventoryHighlighter.updateSettings(event.data.settings);
    }
});

console.log('[Inventory Highlight Injector] Ready');