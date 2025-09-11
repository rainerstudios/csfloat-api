/**
 * Enhanced float data types adapted from CSFloat patterns
 */

export interface RawFloatData {
  floatvalue: number;
  paintseed: number;
  defindex: number;
  paintindex: number;
  stickers?: StickerData[];
  keychains?: KeychainData[];
  nametag?: string;
  quality: number;
  rarity: number;
  origin: number;
  killeatervalue?: number; // StatTrak kills
  imageurl?: string;
  min?: number;
  max?: number;
  weapon_type?: string;
  item_name?: string;
  wear_name?: string;
  origin_name?: string;
}

export interface StickerData {
  stickerId: number;
  slot: number;
  wear?: number;
  name: string;
  imageUrl: string;
  marketPrice?: number;
}

export interface KeychainData {
  keychainId: number;
  name: string;
  imageUrl: string;
}

export interface EnhancedFloatData {
  // Basic float info
  floatValue: number;
  paintSeed: number;
  wearName: string;
  wearRange: [number, number];
  
  // Item identification
  weaponName: string;
  skinName: string;
  fullItemName: string;
  rarity: ItemRarity;
  quality: ItemQuality;
  
  // Market data
  steamPrice?: number;
  averageFloat?: number;
  floatPercentile?: number;
  pricePercentile?: number;
  
  // Pattern analysis
  patternInfo?: PatternInfo;
  blueGemInfo?: BlueGemInfo;
  
  // Additional features
  stickers: StickerData[];
  keychains: KeychainData[];
  statTrakKills?: number;
  nameTag?: string;
  origin: string;
  
  // Analytics
  marketTrends?: MarketTrend[];
  investmentScore?: number;
  rarityScore?: number;
  
  // Metadata
  imageUrl: string;
  inspectUrl: string;
  timestamp: number;
}

export interface ItemRarity {
  id: number;
  name: string;
  color: string;
  tier: 'Consumer' | 'Industrial' | 'Mil-Spec' | 'Restricted' | 'Classified' | 'Covert' | 'Contraband';
}

export interface ItemQuality {
  id: number;
  name: string;
  isStatTrak: boolean;
  isSouvenir: boolean;
}

export interface PatternInfo {
  type: 'fade' | 'case_hardened' | 'doppler' | 'marble_fade' | 'crimson_web' | 'other';
  specialFeatures: string[];
  patternRank?: number;
  patternTier?: string;
  estimatedValue?: number;
}

export interface BlueGemInfo {
  bluePercentage: number;
  tier: string;
  worldRank?: number;
  estimatedValue: {
    min: number;
    max: number;
  };
  confidence: number;
}

export interface MarketTrend {
  date: string;
  price: number;
  volume: number;
  averageFloat: number;
}

export interface FloatAnalysis {
  percentileRank: number;
  isTopTier: boolean;
  comparisonData: {
    betterCount: number;
    totalCount: number;
    averageFloat: number;
    medianFloat: number;
  };
  historicalData: {
    lowestSeen: number;
    highestSeen: number;
    averageSeen: number;
    lastUpdated: number;
  };
}

export interface MarketIntelligence {
  currentPrice: number;
  priceHistory: MarketTrend[];
  supplyEstimate: 'Very Low' | 'Low' | 'Medium' | 'High' | 'Very High';
  demandTrend: 'Rising' | 'Stable' | 'Falling';
  investmentRating: 'Strong Buy' | 'Buy' | 'Hold' | 'Sell' | 'Strong Sell';
  priceTarget: {
    oneWeek: number;
    oneMonth: number;
    threeMonth: number;
  };
  riskFactors: string[];
  opportunities: string[];
}

// Weapon and skin mappings adapted from CSFloat
export const WEAPON_NAMES: Record<number, string> = {
  1: 'Desert Eagle',
  2: 'Dual Berettas',
  3: 'Five-SeveN',
  4: 'Glock-18',
  7: 'AK-47',
  8: 'AUG',
  9: 'AWP',
  10: 'FAMAS',
  11: 'G3SG1',
  13: 'Galil AR',
  14: 'M249',
  16: 'M4A4',
  17: 'MAC-10',
  19: 'P90',
  23: 'MP5-SD',
  24: 'UMP-45',
  25: 'XM1014',
  26: 'PP-Bizon',
  27: 'MAG-7',
  28: 'Negev',
  29: 'Sawed-Off',
  30: 'Tec-9',
  32: 'P2000',
  33: 'MP7',
  34: 'MP9',
  35: 'Nova',
  36: 'P250',
  38: 'SCAR-20',
  39: 'SG 553',
  40: 'SSG 08',
  60: 'M4A1-S',
  61: 'USP-S',
  63: 'CZ75-Auto',
  64: 'R8 Revolver'
};

export const RARITY_INFO: Record<number, ItemRarity> = {
  1: { id: 1, name: 'Consumer Grade', color: '#b0c3d9', tier: 'Consumer' },
  2: { id: 2, name: 'Industrial Grade', color: '#5e98d9', tier: 'Industrial' },
  3: { id: 3, name: 'Mil-Spec Grade', color: '#4b69ff', tier: 'Mil-Spec' },
  4: { id: 4, name: 'Restricted', color: '#8847ff', tier: 'Restricted' },
  5: { id: 5, name: 'Classified', color: '#d32ce6', tier: 'Classified' },
  6: { id: 6, name: 'Covert', color: '#eb4b4b', tier: 'Covert' },
  7: { id: 7, name: 'Contraband', color: '#e4ae39', tier: 'Contraband' }
};

export const QUALITY_INFO: Record<number, ItemQuality> = {
  0: { id: 0, name: 'Normal', isStatTrak: false, isSouvenir: false },
  1: { id: 1, name: 'Genuine', isStatTrak: false, isSouvenir: false },
  3: { id: 3, name: 'Vintage', isStatTrak: false, isSouvenir: false },
  5: { id: 5, name: 'Unusual', isStatTrak: false, isSouvenir: false },
  6: { id: 6, name: 'Unique', isStatTrak: false, isSouvenir: false },
  7: { id: 7, name: 'Community', isStatTrak: false, isSouvenir: false },
  8: { id: 8, name: 'Valve', isStatTrak: false, isSouvenir: false },
  9: { id: 9, name: 'StatTrak™', isStatTrak: true, isSouvenir: false },
  11: { id: 11, name: 'Strange', isStatTrak: false, isSouvenir: false },
  12: { id: 12, name: 'Souvenir', isStatTrak: false, isSouvenir: true }
};

export const WEAR_RANGES: Record<string, [number, number]> = {
  'Factory New': [0.00, 0.07],
  'Minimal Wear': [0.07, 0.15],
  'Field-Tested': [0.15, 0.38],
  'Well-Worn': [0.38, 0.45],
  'Battle-Scarred': [0.45, 1.00]
};

export const ORIGIN_NAMES: Record<number, string> = {
  0: 'Timed Drop',
  1: 'Achievement',
  2: 'Purchased',
  3: 'Traded',
  4: 'Crafted',
  5: 'Store Promotion',
  6: 'Gifted',
  7: 'Support Granted',
  8: 'Found in Crate',
  9: 'Earned',
  10: 'Third-Party Site',
  11: 'Halloween Drop',
  12: 'Steam Purchase',
  14: 'Market',
  15: 'Quest Reward',
  16: 'Level Up Reward'
};