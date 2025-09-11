/**
 * Enhanced Float Service - Extracts maximum value from API responses
 * Adapted from CSFloat patterns with AI-powered analysis
 */

import {
  RawFloatData,
  EnhancedFloatData,
  PatternInfo,
  BlueGemInfo,
  MarketIntelligence,
  FloatAnalysis,
  WEAPON_NAMES,
  RARITY_INFO,
  QUALITY_INFO,
  WEAR_RANGES,
  ORIGIN_NAMES
} from '@/types/float_data';
import { PatternAnalyzer } from './pattern_analyzer';
import { MarketAnalyzer } from './market_analyzer';

export class EnhancedFloatService {
  private patternAnalyzer: PatternAnalyzer;
  private marketAnalyzer: MarketAnalyzer;
  
  constructor() {
    this.patternAnalyzer = new PatternAnalyzer();
    this.marketAnalyzer = new MarketAnalyzer();
  }

  /**
   * Transform raw API data into enhanced float data
   */
  async enhanceFloatData(
    rawData: RawFloatData,
    inspectUrl: string
  ): Promise<EnhancedFloatData> {
    const basicInfo = this.extractBasicInfo(rawData);
    const patternInfo = await this.patternAnalyzer.analyzePattern(rawData);
    const marketData = await this.marketAnalyzer.getMarketIntelligence(basicInfo.fullItemName);
    const floatAnalysis = await this.analyzeFloat(rawData);

    return {
      // Basic float info
      floatValue: rawData.floatvalue,
      paintSeed: rawData.paintseed,
      wearName: this.getWearName(rawData.floatvalue),
      wearRange: this.getWearRange(rawData.floatvalue),
      
      // Item identification
      weaponName: basicInfo.weaponName,
      skinName: basicInfo.skinName,
      fullItemName: basicInfo.fullItemName,
      rarity: basicInfo.rarity,
      quality: basicInfo.quality,
      
      // Market data
      steamPrice: marketData?.currentPrice,
      averageFloat: floatAnalysis.comparisonData.averageFloat,
      floatPercentile: floatAnalysis.percentileRank,
      
      // Pattern analysis
      patternInfo: patternInfo.info,
      blueGemInfo: patternInfo.blueGem,
      
      // Additional features
      stickers: rawData.stickers || [],
      keychains: rawData.keychains || [],
      statTrakKills: rawData.killeatervalue,
      nameTag: rawData.nametag,
      origin: ORIGIN_NAMES[rawData.origin] || `Origin ${rawData.origin}`,
      
      // Analytics
      marketTrends: marketData?.priceHistory || [],
      investmentScore: this.calculateInvestmentScore(rawData, patternInfo, marketData),
      rarityScore: this.calculateRarityScore(rawData, patternInfo),
      
      // Metadata
      imageUrl: rawData.imageurl || '',
      inspectUrl,
      timestamp: Date.now()
    };
  }

  private extractBasicInfo(rawData: RawFloatData) {
    const weaponName = WEAPON_NAMES[rawData.defindex] || `Weapon ${rawData.defindex}`;
    const skinName = rawData.item_name || `Paint ${rawData.paintindex}`;
    const fullItemName = rawData.weapon_type || `${weaponName} | ${skinName}`;
    const rarity = RARITY_INFO[rawData.rarity] || RARITY_INFO[1];
    const quality = QUALITY_INFO[rawData.quality] || QUALITY_INFO[0];

    return {
      weaponName,
      skinName,
      fullItemName,
      rarity,
      quality
    };
  }

  private getWearName(floatValue: number): string {
    if (floatValue < 0.07) return 'Factory New';
    if (floatValue < 0.15) return 'Minimal Wear';
    if (floatValue < 0.38) return 'Field-Tested';
    if (floatValue < 0.45) return 'Well-Worn';
    return 'Battle-Scarred';
  }

  private getWearRange(floatValue: number): [number, number] {
    const wearName = this.getWearName(floatValue);
    return WEAR_RANGES[wearName];
  }

  private async analyzeFloat(rawData: RawFloatData): Promise<FloatAnalysis> {
    // This would integrate with historical database
    // For now, provide mock analysis based on wear ranges
    const [minWear, maxWear] = this.getWearRange(rawData.floatvalue);
    const percentileInWear = (rawData.floatvalue - minWear) / (maxWear - minWear);
    const percentileRank = (1 - percentileInWear) * 100;

    return {
      percentileRank,
      isTopTier: percentileRank >= 90,
      comparisonData: {
        betterCount: Math.floor(percentileRank * 10),
        totalCount: 1000, // Mock data
        averageFloat: (minWear + maxWear) / 2,
        medianFloat: (minWear + maxWear) / 2
      },
      historicalData: {
        lowestSeen: rawData.min || minWear,
        highestSeen: rawData.max || maxWear,
        averageSeen: (minWear + maxWear) / 2,
        lastUpdated: Date.now()
      }
    };
  }

  private calculateInvestmentScore(
    rawData: RawFloatData,
    patternInfo: { info?: PatternInfo; blueGem?: BlueGemInfo },
    marketData?: MarketIntelligence
  ): number {
    let score = 5; // Base score out of 10

    // Rarity bonus
    if (rawData.rarity >= 5) score += 2; // Classified/Covert
    if (rawData.rarity >= 6) score += 1; // Covert bonus

    // Float bonus
    if (rawData.floatvalue < 0.01) score += 2; // Very low float
    else if (rawData.floatvalue < 0.07) score += 1; // Factory New

    // Pattern bonus
    if (patternInfo.blueGem && patternInfo.blueGem.bluePercentage > 70) {
      score += 3; // High blue gem
    }
    if (patternInfo.info && patternInfo.info.patternTier === 'Tier 1') {
      score += 2;
    }

    // StatTrak bonus
    if (rawData.killeatervalue !== undefined) score += 1;

    // Market trend bonus
    if (marketData?.investmentRating === 'Strong Buy') score += 2;
    else if (marketData?.investmentRating === 'Buy') score += 1;

    return Math.min(Math.max(score, 1), 10);
  }

  private calculateRarityScore(
    rawData: RawFloatData,
    patternInfo: { info?: PatternInfo; blueGem?: BlueGemInfo }
  ): number {
    let score = rawData.rarity || 1;

    // Pattern rarity multiplier
    if (patternInfo.blueGem && patternInfo.blueGem.bluePercentage > 80) {
      score *= 2;
    }
    
    if (patternInfo.info && patternInfo.info.patternRank && patternInfo.info.patternRank <= 100) {
      score *= 1.5;
    }

    // Float rarity
    if (rawData.floatvalue < 0.001) score *= 1.8;
    else if (rawData.floatvalue < 0.01) score *= 1.5;
    else if (rawData.floatvalue > 0.99) score *= 1.3; // High float rarity

    return Math.min(score, 10);
  }

  /**
   * Get sticker value information
   */
  async getStickerValue(stickers: any[]): Promise<number> {
    let totalValue = 0;
    
    for (const sticker of stickers) {
      // This would query sticker price APIs
      // For now, provide basic estimates based on known expensive stickers
      if (sticker.name?.includes('Katowice 2014')) {
        totalValue += 100; // Base estimate
      } else if (sticker.name?.includes('Titan') && sticker.name?.includes('Holo')) {
        totalValue += 500; // High-value holo
      }
      // Add more sticker value logic here
    }
    
    return totalValue;
  }

  /**
   * Check if item is a blue gem
   */
  isBlueGem(rawData: RawFloatData): boolean {
    return rawData.weapon_type?.includes('Case Hardened') || 
           rawData.item_name?.includes('Case Hardened') ||
           false;
  }

  /**
   * Get comprehensive item summary
   */
  getItemSummary(enhancedData: EnhancedFloatData): string {
    const parts = [
      enhancedData.fullItemName,
      `(${enhancedData.wearName})`,
      `Float: ${enhancedData.floatValue.toFixed(6)}`,
      enhancedData.floatPercentile ? `(Top ${(100 - enhancedData.floatPercentile).toFixed(1)}%)` : '',
      enhancedData.statTrakKills ? `StatTrak™: ${enhancedData.statTrakKills} kills` : '',
      enhancedData.blueGemInfo ? `${enhancedData.blueGemInfo.bluePercentage}% Blue Gem` : '',
      enhancedData.patternInfo?.patternTier ? `Pattern: ${enhancedData.patternInfo.patternTier}` : ''
    ].filter(Boolean);

    return parts.join(' | ');
  }
}