/**
 * Style Manager - Centralized styling and theme management
 * Handles CSS injection, theme switching, and dynamic style updates
 */

import { injectBaseStyles, removeExtensionStyles, updateThemeStyles, createResponsiveStyles, injectCSS, createCSSRules } from '../utils/css.js';
import { CSS_CLASSES } from '../utils/constants.js';

export class StyleManager {
    constructor(options = {}) {
        this.contentManager = options.contentManager;
        this.currentTheme = 'dark';
        this.customStyles = new Map();
        this.injectedStyles = new Map();
        this.isInitialized = false;
        
        this.log = this.contentManager?.log.bind(this.contentManager) || console.log;
    }
    
    /**
     * Initialize the style manager
     */
    init() {
        if (this.isInitialized) {
            this.log('StyleManager already initialized');
            return Promise.resolve();
        }
        
        try {
            this.log('Initializing StyleManager...');
            
            // Inject base extension styles
            this.injectBaseStyles();
            
            // Apply current theme
            this.applyTheme(this.currentTheme);
            
            // Handle responsive changes
            this.setupResponsiveHandling();
            
            // Handle dynamic style updates
            this.setupDynamicStyles();
            
            this.isInitialized = true;
            this.log('✅ StyleManager initialized');
            
        } catch (error) {
            this.log('❌ StyleManager initialization failed:', error);
        }
        
        return Promise.resolve();
    }
    
    /**
     * Inject base extension styles
     */
    injectBaseStyles() {
        try {
            injectBaseStyles();
            this.log('✅ Base styles injected');
        } catch (error) {
            this.log('❌ Failed to inject base styles:', error);
        }
    }
    
    /**
     * Apply a theme
     * @param {string} themeName - Theme name
     */
    applyTheme(themeName) {
        const themes = this.getThemes();
        const theme = themes[themeName];
        
        if (!theme) {
            this.log(`❌ Unknown theme: ${themeName}`);
            return;
        }
        
        this.currentTheme = themeName;
        updateThemeStyles(theme);
        
        this.log(`✅ Applied theme: ${themeName}`);
    }
    
    /**
     * Get available themes
     * @returns {Object} Themes object
     */
    getThemes() {
        return {
            dark: {
                name: 'Dark',
                textColor: '#ffffff',
                panelBackground: 'rgba(0, 0, 0, 0.9)',
                borderColor: '#333',
                primaryColor: '#22c55e',
                secondaryColor: '#6b7280',
                dangerColor: '#ef4444',
                warningColor: '#fbbf24'
            },
            
            light: {
                name: 'Light',
                textColor: '#000000',
                panelBackground: 'rgba(255, 255, 255, 0.95)',
                borderColor: '#d1d5db',
                primaryColor: '#059669',
                secondaryColor: '#6b7280',
                dangerColor: '#dc2626',
                warningColor: '#d97706'
            },
            
            steam: {
                name: 'Steam',
                textColor: '#c7d5e0',
                panelBackground: 'rgba(23, 32, 42, 0.95)',
                borderColor: '#495a69',
                primaryColor: '#4c6b22',
                secondaryColor: '#67c1f5',
                dangerColor: '#cd422b',
                warningColor: '#cd9b1d'
            }
        };
    }
    
    /**
     * Setup responsive style handling
     */
    setupResponsiveHandling() {
        const updateResponsiveStyles = () => {
            const responsiveStyles = createResponsiveStyles();
            const css = createCSSRules(responsiveStyles);
            this.injectCustomCSS(css, 'responsive-styles');
        };
        
        // Update on window resize
        window.addEventListener('resize', updateResponsiveStyles);
        
        // Initial update
        updateResponsiveStyles();
        
        this.log('✅ Responsive style handling setup');
    }
    
    /**
     * Setup dynamic style updates
     */
    setupDynamicStyles() {
        // Create dynamic style rules for float displays
        this.createFloatDisplayStyles();
        
        // Create dynamic animation styles
        this.createAnimationStyles();
        
        this.log('✅ Dynamic styles setup');
    }
    
    /**
     * Create dynamic float display styles
     */
    createFloatDisplayStyles() {
        const floatDisplayStyles = {
            // Hover effects for copyable elements
            [`.${CSS_CLASSES.FLOAT_COPYABLE}:hover`]: {
                opacity: '0.8',
                textShadow: '0 0 3px currentColor'
            },
            
            // Active state for copyable elements
            [`.${CSS_CLASSES.FLOAT_COPYABLE}:active`]: {
                transform: 'scale(0.95)'
            },
            
            // Loading state
            [`.${CSS_CLASSES.FLOAT_DISPLAY}.loading`]: {
                opacity: '0.6'
            },
            
            // Error state
            [`.${CSS_CLASSES.FLOAT_DISPLAY}.error`]: {
                color: '#ef4444',
                textDecoration: 'line-through'
            },
            
            // Success state (after copy)
            [`.${CSS_CLASSES.FLOAT_DISPLAY}.success`]: {
                color: '#22c55e'
            }
        };
        
        const css = createCSSRules(floatDisplayStyles);
        this.injectCustomCSS(css, 'float-display-dynamic');
    }
    
    /**
     * Create animation styles
     */
    createAnimationStyles() {
        const animationStyles = {
            // Fade in animation
            [`.cs2-fade-in`]: {
                animation: 'fadeIn 0.3s ease-in'
            },
            
            // Slide down animation
            [`.cs2-slide-down`]: {
                animation: 'slideDown 0.2s ease-out'
            },
            
            // Pulse animation
            [`.cs2-pulse`]: {
                animation: 'pulse 2s ease-in-out infinite'
            },
            
            // Shimmer effect for loading
            [`.cs2-shimmer`]: {
                background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
                backgroundSize: '1000px 100%',
                animation: 'shimmer 3s ease-in-out infinite'
            }
        };
        
        const css = createCSSRules(animationStyles);
        this.injectCustomCSS(css, 'animations');
    }
    
    /**
     * Inject custom CSS
     * @param {string} css - CSS string
     * @param {string} id - Style ID
     */
    injectCustomCSS(css, id) {
        const fullId = `cs2-extension-${id}`;
        const styleElement = injectCSS(css, fullId);
        this.injectedStyles.set(id, styleElement);
        return styleElement;
    }
    
    /**
     * Remove custom CSS
     * @param {string} id - Style ID
     */
    removeCustomCSS(id) {
        const styleElement = this.injectedStyles.get(id);
        if (styleElement && styleElement.parentNode) {
            styleElement.parentNode.removeChild(styleElement);
            this.injectedStyles.delete(id);
        }
    }
    
    /**
     * Add custom styles for a component
     * @param {string} componentName - Component name
     * @param {Object} styles - Style rules
     */
    addComponentStyles(componentName, styles) {
        this.customStyles.set(componentName, styles);
        
        const css = createCSSRules(styles);
        this.injectCustomCSS(css, `component-${componentName}`);
        
        this.log(`✅ Added styles for component: ${componentName}`);
    }
    
    /**
     * Remove styles for a component
     * @param {string} componentName - Component name
     */
    removeComponentStyles(componentName) {
        this.customStyles.delete(componentName);
        this.removeCustomCSS(`component-${componentName}`);
        
        this.log(`✅ Removed styles for component: ${componentName}`);
    }
    
    /**
     * Update CSS variable
     * @param {string} variable - CSS variable name
     * @param {string} value - CSS variable value
     */
    setCSSVariable(variable, value) {
        document.documentElement.style.setProperty(variable, value);
    }
    
    /**
     * Get CSS variable value
     * @param {string} variable - CSS variable name
     * @returns {string} CSS variable value
     */
    getCSSVariable(variable) {
        return getComputedStyle(document.documentElement).getPropertyValue(variable);
    }
    
    /**
     * Create styles for float conditions
     * @param {Object} wearRanges - Wear ranges configuration
     */
    createFloatConditionStyles(wearRanges) {
        const conditionStyles = {};
        
        Object.entries(wearRanges).forEach(([condition, config]) => {
            const className = `.cs2-wear-${condition.toLowerCase().replace('_', '-')}`;
            conditionStyles[className] = {
                color: config.color,
                fontWeight: 'bold'
            };
        });
        
        const css = createCSSRules(conditionStyles);
        this.injectCustomCSS(css, 'wear-conditions');
    }
    
    /**
     * Create print styles for better printing
     */
    createPrintStyles() {
        const printStyles = {
            '@media print': {
                [`.${CSS_CLASSES.FILTER_PANEL}`]: {
                    display: 'none'
                },
                [`.${CSS_CLASSES.FILTER_TOGGLE}`]: {
                    display: 'none'
                },
                [`.${CSS_CLASSES.FLOAT_DISPLAY}`]: {
                    background: 'transparent !important',
                    color: '#000 !important'
                }
            }
        };
        
        const css = Object.entries(printStyles).map(([media, rules]) => {
            const ruleCSS = createCSSRules(rules);
            return `${media} { ${ruleCSS} }`;
        }).join('\n');
        
        this.injectCustomCSS(css, 'print-styles');
    }
    
    /**
     * Handle high contrast mode
     * @param {boolean} enabled - Whether high contrast is enabled
     */
    setHighContrastMode(enabled) {
        if (enabled) {
            const highContrastStyles = {
                [`.${CSS_CLASSES.FLOAT_DISPLAY}`]: {
                    border: '2px solid currentColor',
                    background: 'white',
                    color: 'black'
                },
                [`.${CSS_CLASSES.FLOAT_VALUE}`]: {
                    fontWeight: '900'
                }
            };
            
            const css = createCSSRules(highContrastStyles);
            this.injectCustomCSS(css, 'high-contrast');
        } else {
            this.removeCustomCSS('high-contrast');
        }
    }
    
    /**
     * Get current theme name
     * @returns {string} Current theme name
     */
    getCurrentTheme() {
        return this.currentTheme;
    }
    
    /**
     * Get all custom styles
     * @returns {Map} Custom styles map
     */
    getCustomStyles() {
        return new Map(this.customStyles);
    }
    
    /**
     * Handle events from content manager
     * @param {string} eventType - Event type
     * @param {any} data - Event data
     */
    handleEvent(eventType, data) {
        switch (eventType) {
            case 'settingsChanged':
                this.handleSettingsChange(data);
                break;
                
            case 'themeChanged':
                this.applyTheme(data.theme);
                break;
                
            default:
                // Ignore unknown events
                break;
        }
    }
    
    /**
     * Handle settings changes
     * @param {Object} settings - New settings
     */
    handleSettingsChange(settings) {
        if (settings.theme && settings.theme !== this.currentTheme) {
            this.applyTheme(settings.theme);
        }
        
        if (settings.highContrast !== undefined) {
            this.setHighContrastMode(settings.highContrast);
        }
    }
    
    /**
     * Cleanup and remove all styles
     */
    destroy() {
        this.log('Destroying StyleManager...');
        
        // Remove all custom styles
        for (const [id] of this.injectedStyles) {
            this.removeCustomCSS(id);
        }
        
        // Remove base styles
        removeExtensionStyles();
        
        // Clear maps
        this.customStyles.clear();
        this.injectedStyles.clear();
        
        this.isInitialized = false;
        this.log('✅ StyleManager destroyed');
    }
}