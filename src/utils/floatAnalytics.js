/**
 * Float Analytics Module
 * Advanced float value analysis and statistics
 */

export class FloatAnalytics {
    constructor() {
        this.floatDatabase = new Map();
        this.percentileCache = new Map();
    }

    /**
     * Calculate float percentile ranking
     * @param {number} floatValue - The float value to rank
     * @param {string} itemName - The item name for comparison
     * @returns {number} Percentile ranking (0-100)
     */
    calculatePercentile(floatValue, itemName) {
        // This would normally query a database of known floats
        // For now, we'll use a simple calculation based on wear ranges
        
        const wearRanges = {
            'Factory New': { min: 0.00, max: 0.07 },
            'Minimal Wear': { min: 0.07, max: 0.15 },
            'Field-Tested': { min: 0.15, max: 0.37 },
            'Well-Worn': { min: 0.37, max: 0.44 },
            'Battle-Scarred': { min: 0.44, max: 1.00 }
        };
        
        // Determine which wear tier this float belongs to
        let wearTier = 'Battle-Scarred';
        for (const [wear, range] of Object.entries(wearRanges)) {
            if (floatValue >= range.min && floatValue < range.max) {
                wearTier = wear;
                break;
            }
        }
        
        // Calculate percentile within the wear tier
        const range = wearRanges[wearTier];
        const position = (floatValue - range.min) / (range.max - range.min);
        
        // Lower float is better, so invert the percentile
        const percentile = (1 - position) * 100;
        
        return {
            percentile: percentile.toFixed(2),
            wearTier,
            isLowFloat: floatValue < 0.03,
            isHighFloat: floatValue > 0.97,
            rarity: this.getRarityTier(percentile)
        };
    }
    
    /**
     * Get rarity tier based on percentile
     */
    getRarityTier(percentile) {
        if (percentile >= 99) return 'Legendary';
        if (percentile >= 95) return 'Epic';
        if (percentile >= 85) return 'Rare';
        if (percentile >= 70) return 'Uncommon';
        return 'Common';
    }
    
    /**
     * Calculate estimated price premium based on float
     */
    calculateFloatPremium(floatValue, basePrice) {
        let multiplier = 1;
        
        // Low float premium
        if (floatValue < 0.001) multiplier = 3.0;
        else if (floatValue < 0.01) multiplier = 2.0;
        else if (floatValue < 0.03) multiplier = 1.5;
        else if (floatValue < 0.07) multiplier = 1.2;
        
        // High float premium (for some items)
        else if (floatValue > 0.99) multiplier = 1.8;
        else if (floatValue > 0.97) multiplier = 1.3;
        
        return {
            estimatedPrice: (basePrice * multiplier).toFixed(2),
            premium: ((multiplier - 1) * 100).toFixed(0) + '%',
            multiplier
        };
    }
    
    /**
     * Generate float distribution visualization
     */
    generateDistribution(floatValue, min = 0, max = 1) {
        const segments = 20;
        const segmentWidth = (max - min) / segments;
        const currentSegment = Math.floor((floatValue - min) / segmentWidth);
        
        let distribution = '';
        for (let i = 0; i < segments; i++) {
            if (i === currentSegment) {
                distribution += '█';
            } else {
                distribution += '░';
            }
        }
        
        return {
            visual: distribution,
            position: ((floatValue - min) / (max - min) * 100).toFixed(1) + '%',
            range: `${min.toFixed(2)} - ${max.toFixed(2)}`
        };
    }
    
    /**
     * Check if pattern is rare (for Case Hardened, Fade, etc.)
     */
    checkPatternRarity(paintSeed, weaponType) {
        const rarePatterns = {
            'AK-47 | Case Hardened': {
                bluGems: [661, 670, 321, 4, 13, 28, 32, 34, 57, 92, 103, 112, 122, 139, 150],
                tier1: [168, 169, 179, 182, 202, 205, 206, 209, 219, 228]
            },
            'Karambit | Fade': {
                '100%': [1, 2, 3, 4, 5, 6, 7, 8],
                '90/10': [9, 10, 11, 12, 13, 14, 15]
            }
        };
        
        const patterns = rarePatterns[weaponType];
        if (!patterns) return null;
        
        for (const [tier, seeds] of Object.entries(patterns)) {
            if (seeds.includes(paintSeed)) {
                return {
                    isRare: true,
                    tier,
                    description: `Rare ${tier} pattern!`
                };
            }
        }
        
        return { isRare: false };
    }
}

export const floatAnalytics = new FloatAnalytics();