/**
 * Pattern Database for CS2 Float Extension
 * Handles Case Hardened blue gems, Doppler phases, Fade percentages, and other rare patterns
 * @version 1.0.0
 * @author CS2 Float Checker Team
 */

class PatternDatabase {
    constructor() {
        this.initializePatternData();
    }

    /**
     * Initialize pattern recognition data
     */
    initializePatternData() {
        // Case Hardened Blue Gem Patterns (Top tier patterns)
        this.blueGemPatterns = {
            // AK-47 Case Hardened Blue Gems
            'AK-47': {
                661: { tier: 1, name: '#1 Blue Gem', bluePercentage: 95, description: 'Legendary pattern' },
                670: { tier: 1, name: '#2 Blue Gem', bluePercentage: 94, description: 'Extremely rare' },
                955: { tier: 1, name: '#3 Blue Gem', bluePercentage: 93, description: 'Museum quality' },
                809: { tier: 2, name: 'Top Blue Gem', bluePercentage: 90, description: 'High tier blue' },
                828: { tier: 2, name: 'Blue Gem', bluePercentage: 89, description: 'Highly valuable' },
                179: { tier: 2, name: 'Blue Gem', bluePercentage: 88, description: 'Collector item' },
                387: { tier: 3, name: 'Blue Top', bluePercentage: 85, description: 'Good blue coverage' },
                760: { tier: 3, name: 'Blue Top', bluePercentage: 84, description: 'Solid blue pattern' },
                592: { tier: 3, name: 'Blue Top', bluePercentage: 82, description: 'Nice blue top' }
            },
            // Five-SeveN Case Hardened Blue Gems
            'Five-SeveN': {
                278: { tier: 1, name: '#1 Blue Gem', bluePercentage: 98, description: 'Perfect blue' },
                189: { tier: 1, name: '#2 Blue Gem', bluePercentage: 96, description: 'Nearly perfect' },
                868: { tier: 2, name: 'Blue Gem', bluePercentage: 92, description: 'Excellent blue' },
                363: { tier: 2, name: 'Blue Gem', bluePercentage: 90, description: 'High tier pattern' }
            }
        };

        // Doppler Phase Detection
        this.dopplerPhases = {
            415: { phase: 'Ruby', rarity: 'Extremely Rare', color: '#8B0000', multiplier: 3.5 },
            416: { phase: 'Sapphire', rarity: 'Extremely Rare', color: '#0000FF', multiplier: 3.2 },
            417: { phase: 'Black Pearl', rarity: 'Extremely Rare', color: '#2F2F2F', multiplier: 2.8 },
            418: { phase: 'Phase 1', rarity: 'Rare', color: '#4A0080', multiplier: 1.2 },
            419: { phase: 'Phase 2', rarity: 'Rare', color: '#FF1493', multiplier: 1.15 },
            420: { phase: 'Phase 3', rarity: 'Uncommon', color: '#00CED1', multiplier: 1.1 },
            421: { phase: 'Phase 4', rarity: 'Uncommon', color: '#32CD32', multiplier: 1.05 }
        };

        // Fade Patterns (paintindex 38 = Fade)
        this.fadePatterns = {
            // High fade percentages (pattern seed ranges)
            high: { min: 1, max: 50, percentage: '95-100%', description: 'Full Fade', multiplier: 2.0 },
            medium: { min: 51, max: 150, percentage: '85-95%', description: 'High Fade', multiplier: 1.5 },
            low: { min: 151, max: 400, percentage: '70-85%', description: 'Medium Fade', multiplier: 1.2 },
            minimal: { min: 401, max: 1000, percentage: '50-70%', description: 'Low Fade', multiplier: 1.0 }
        };

        // Marble Fade Patterns
        this.marbleFadePatterns = {
            'Fire & Ice': {
                seeds: [412, 688, 25, 436, 555, 344, 750],
                tier: 1,
                description: 'Red and Blue only, no yellow',
                multiplier: 2.5
            },
            'Blue Dominant': {
                seeds: [601, 580, 350, 736, 853],
                tier: 2, 
                description: 'Mostly blue with red accents',
                multiplier: 1.8
            },
            'Red Tip': {
                seeds: [169, 770, 494],
                tier: 3,
                description: 'Red tip pattern',
                multiplier: 1.3
            }
        };
    }

    /**
     * Analyze item pattern and return recognition results
     * @param {Object} itemInfo - Item information from API
     * @returns {Object|null} Pattern analysis results
     */
    analyzePattern(itemInfo) {
        if (!itemInfo || !itemInfo.weapon_type || !itemInfo.paintseed) {
            return null;
        }

        const weaponName = this.extractWeaponName(itemInfo.weapon_type);
        const paintSeed = parseInt(itemInfo.paintseed);
        const paintIndex = parseInt(itemInfo.paintindex);

        // Check for Case Hardened patterns (paintindex 44)
        if (paintIndex === 44) {
            return this.analyzeCaseHardened(weaponName, paintSeed);
        }

        // Check for Doppler patterns (paintindex 415-421)
        if (paintIndex >= 415 && paintIndex <= 421) {
            return this.analyzeDoppler(paintIndex, paintSeed);
        }

        // Check for Fade patterns (paintindex 38)
        if (paintIndex === 38) {
            return this.analyzeFade(paintSeed);
        }

        // Check for Marble Fade patterns (paintindex 413)
        if (paintIndex === 413) {
            return this.analyzeMarbleFade(paintSeed);
        }

        return null;
    }

    /**
     * Analyze Case Hardened patterns for blue gems
     * @param {string} weaponName - Name of the weapon
     * @param {number} paintSeed - Paint seed value
     * @returns {Object|null} Blue gem analysis
     */
    analyzeCaseHardened(weaponName, paintSeed) {
        const weaponPatterns = this.blueGemPatterns[weaponName];
        if (!weaponPatterns || !weaponPatterns[paintSeed]) {
            // Not a known blue gem pattern
            return {
                type: 'Case Hardened',
                isSpecial: false,
                message: 'Standard Case Hardened pattern'
            };
        }

        const pattern = weaponPatterns[paintSeed];
        return {
            type: 'Case Hardened Blue Gem',
            isSpecial: true,
            tier: pattern.tier,
            name: pattern.name,
            bluePercentage: pattern.bluePercentage,
            description: pattern.description,
            rarity: this.getTierRarity(pattern.tier),
            multiplier: this.getBlueGemMultiplier(pattern.tier),
            message: `🔷 ${pattern.name} - ${pattern.bluePercentage}% Blue`
        };
    }

    /**
     * Analyze Doppler patterns
     * @param {number} paintIndex - Paint index (415-421)
     * @param {number} paintSeed - Paint seed for visual variation
     * @returns {Object} Doppler analysis
     */
    analyzeDoppler(paintIndex, paintSeed) {
        const doppler = this.dopplerPhases[paintIndex];
        if (!doppler) {
            return null;
        }

        return {
            type: 'Doppler',
            isSpecial: paintIndex <= 417, // Ruby, Sapphire, Black Pearl are special
            phase: doppler.phase,
            rarity: doppler.rarity,
            color: doppler.color,
            multiplier: doppler.multiplier,
            message: `💎 ${doppler.phase} - ${doppler.rarity}`
        };
    }

    /**
     * Analyze Fade patterns
     * @param {number} paintSeed - Paint seed value
     * @returns {Object} Fade analysis
     */
    analyzeFade(paintSeed) {
        let fadeInfo = null;
        for (const [category, data] of Object.entries(this.fadePatterns)) {
            if (paintSeed >= data.min && paintSeed <= data.max) {
                fadeInfo = data;
                break;
            }
        }

        if (!fadeInfo) {
            return {
                type: 'Fade',
                isSpecial: false,
                message: 'Unknown fade percentage'
            };
        }

        return {
            type: 'Fade',
            isSpecial: fadeInfo.multiplier > 1.5,
            percentage: fadeInfo.percentage,
            description: fadeInfo.description,
            multiplier: fadeInfo.multiplier,
            message: `🌈 ${fadeInfo.description} (${fadeInfo.percentage})`
        };
    }

    /**
     * Analyze Marble Fade patterns
     * @param {number} paintSeed - Paint seed value
     * @returns {Object|null} Marble Fade analysis
     */
    analyzeMarbleFade(paintSeed) {
        for (const [patternName, data] of Object.entries(this.marbleFadePatterns)) {
            if (data.seeds.includes(paintSeed)) {
                return {
                    type: 'Marble Fade',
                    isSpecial: true,
                    pattern: patternName,
                    tier: data.tier,
                    description: data.description,
                    multiplier: data.multiplier,
                    rarity: this.getTierRarity(data.tier),
                    message: `🔥 ${patternName} - Tier ${data.tier}`
                };
            }
        }

        return {
            type: 'Marble Fade',
            isSpecial: false,
            message: 'Standard Marble Fade pattern'
        };
    }

    /**
     * Extract weapon name from full item name
     * @param {string} weaponType - Full weapon type string
     * @returns {string} Clean weapon name
     */
    extractWeaponName(weaponType) {
        // Extract weapon name before the "|" separator
        return weaponType.split(' |')[0].trim();
    }

    /**
     * Get rarity description based on tier
     * @param {number} tier - Tier number (1-3)
     * @returns {string} Rarity description
     */
    getTierRarity(tier) {
        switch (tier) {
            case 1: return 'Legendary';
            case 2: return 'Extremely Rare';
            case 3: return 'Very Rare';
            default: return 'Rare';
        }
    }

    /**
     * Get price multiplier for blue gem tiers
     * @param {number} tier - Blue gem tier
     * @returns {number} Price multiplier
     */
    getBlueGemMultiplier(tier) {
        switch (tier) {
            case 1: return 50.0;  // Legendary blue gems
            case 2: return 15.0;  // High tier blue gems
            case 3: return 5.0;   // Good blue gems
            default: return 1.0;
        }
    }

    /**
     * Create pattern display element
     * @param {Object} patternInfo - Pattern analysis results
     * @param {string} type - Display type ('market' or 'inventory')
     * @returns {HTMLElement|null} Pattern display element
     */
    createPatternDisplay(patternInfo, type = 'market') {
        if (!patternInfo || !patternInfo.isSpecial) {
            return null;
        }

        const container = document.createElement('div');
        container.className = `cs2-pattern-display cs2-pattern-${type}`;

        if (type === 'market') {
            container.innerHTML = `
                <div class="cs2-pattern-info" style="
                    background: linear-gradient(45deg, rgba(255, 215, 0, 0.1), rgba(255, 215, 0, 0.2));
                    border-left: 3px solid #FFD700;
                    color: #FFD700;
                    padding: 4px 6px;
                    margin: 2px 0;
                    border-radius: 3px;
                    font-size: 11px;
                    font-weight: bold;
                    text-shadow: 1px 1px 0px rgba(0, 0, 0, 0.8);
                ">
                    ${patternInfo.message}
                </div>
            `;
        } else {
            // Inventory display - more compact
            container.innerHTML = `
                <div class="cs2-pattern-inventory" style="
                    position: absolute;
                    top: 2px;
                    right: 2px;
                    background: rgba(255, 215, 0, 0.9);
                    color: #000;
                    padding: 1px 3px;
                    border-radius: 2px;
                    font-size: 8px;
                    font-weight: bold;
                    z-index: 1001;
                ">
                    ${patternInfo.tier ? `T${patternInfo.tier}` : '✨'}
                </div>
            `;
        }

        return container;
    }

    /**
     * Get pattern tooltip information
     * @param {Object} patternInfo - Pattern analysis results
     * @returns {string} Tooltip text
     */
    getPatternTooltip(patternInfo) {
        if (!patternInfo) return '';

        let tooltip = `Pattern: ${patternInfo.type}\\n`;
        
        if (patternInfo.name) tooltip += `Name: ${patternInfo.name}\\n`;
        if (patternInfo.tier) tooltip += `Tier: ${patternInfo.tier}\\n`;
        if (patternInfo.rarity) tooltip += `Rarity: ${patternInfo.rarity}\\n`;
        if (patternInfo.bluePercentage) tooltip += `Blue: ${patternInfo.bluePercentage}%\\n`;
        if (patternInfo.percentage) tooltip += `Fade: ${patternInfo.percentage}\\n`;
        if (patternInfo.multiplier) tooltip += `Est. Multiplier: ${patternInfo.multiplier}x\\n`;
        if (patternInfo.description) tooltip += `${patternInfo.description}`;

        return tooltip;
    }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PatternDatabase;
} else {
    window.PatternDatabase = PatternDatabase;
}