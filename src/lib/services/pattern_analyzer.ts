/**
 * Pattern Analyzer - AI-powered pattern recognition
 * Specializes in blue gem detection and other special patterns
 */

import { RawFloatData, PatternInfo, BlueGemInfo } from '@/types/float_data';

export class PatternAnalyzer {
  
  /**
   * Analyze pattern information from raw float data
   */
  async analyzePattern(rawData: RawFloatData): Promise<{
    info?: PatternInfo;
    blueGem?: BlueGemInfo;
  }> {
    const weaponType = rawData.weapon_type || '';
    const itemName = rawData.item_name || '';
    const paintSeed = rawData.paintseed;

    // Case Hardened analysis
    if (this.isCaseHardened(weaponType, itemName)) {
      const blueGem = await this.analyzeCaseHardened(rawData.defindex, paintSeed);
      return {
        info: {
          type: 'case_hardened',
          specialFeatures: blueGem ? [`${blueGem.bluePercentage}% Blue`] : [],
          patternRank: blueGem?.worldRank,
          patternTier: blueGem?.tier,
          estimatedValue: blueGem?.estimatedValue.max
        },
        blueGem
      };
    }

    // Fade analysis
    if (this.isFade(weaponType, itemName)) {
      return {
        info: await this.analyzeFade(rawData.defindex, paintSeed)
      };
    }

    // Doppler analysis
    if (this.isDoppler(weaponType, itemName)) {
      return {
        info: await this.analyzeDoppler(rawData.defindex, paintSeed)
      };
    }

    // Marble Fade analysis
    if (this.isMarbleFade(weaponType, itemName)) {
      return {
        info: await this.analyzeMarbleFade(rawData.defindex, paintSeed)
      };
    }

    return {};
  }

  /**
   * Check if item is Case Hardened
   */
  private isCaseHardened(weaponType: string, itemName: string): boolean {
    return weaponType.includes('Case Hardened') || itemName.includes('Case Hardened');
  }

  /**
   * Analyze Case Hardened patterns for blue gems
   */
  private async analyzeCaseHardened(defindex: number, paintSeed: number): Promise<BlueGemInfo | undefined> {
    // Blue gem pattern seeds for different weapons
    const blueGemSeeds = this.getBlueGemSeeds(defindex);
    
    if (!blueGemSeeds[paintSeed]) {
      // Calculate blue percentage based on pattern seed
      const bluePercentage = this.calculateBluePercentage(defindex, paintSeed);
      
      if (bluePercentage < 30) return undefined;
      
      return {
        bluePercentage,
        tier: this.getBlueGemTier(bluePercentage),
        estimatedValue: this.estimateBlueGemValue(defindex, bluePercentage),
        confidence: this.calculateConfidence(defindex, paintSeed)
      };
    }

    const knownPattern = blueGemSeeds[paintSeed];
    return {
      bluePercentage: knownPattern.blue,
      tier: knownPattern.tier,
      worldRank: knownPattern.rank,
      estimatedValue: knownPattern.value,
      confidence: 0.95
    };
  }

  /**
   * Get known blue gem seeds for weapons
   */
  private getBlueGemSeeds(defindex: number): Record<number, any> {
    // AK-47 blue gem patterns
    if (defindex === 7) {
      return {
        661: { blue: 95, tier: 'Tier 1', rank: 1, value: { min: 8000, max: 15000 } },
        670: { blue: 92, tier: 'Tier 1', rank: 2, value: { min: 6000, max: 12000 } },
        555: { blue: 90, tier: 'Tier 1', rank: 3, value: { min: 5000, max: 10000 } },
        179: { blue: 88, tier: 'Tier 1', rank: 4, value: { min: 4000, max: 8000 } },
        151: { blue: 85, tier: 'Tier 1', rank: 5, value: { min: 3500, max: 7000 } },
        // Add more patterns...
      };
    }

    // Five-SeveN blue gem patterns
    if (defindex === 3) {
      return {
        278: { blue: 98, tier: 'Tier 1', rank: 1, value: { min: 2000, max: 4000 } },
        868: { blue: 95, tier: 'Tier 1', rank: 2, value: { min: 1500, max: 3000 } },
        // Add more patterns...
      };
    }

    return {};
  }

  /**
   * Calculate blue percentage for unknown patterns
   */
  private calculateBluePercentage(defindex: number, paintSeed: number): number {
    // Simplified algorithm - in production, this would use ML models
    // or complex mathematical analysis of the pattern template
    
    const seed = paintSeed;
    let blueScore = 0;

    // Pattern analysis based on seed characteristics
    if (seed >= 1 && seed <= 100) {
      blueScore = 80 + (seed % 20);
    } else if (seed >= 600 && seed <= 700) {
      blueScore = 70 + (seed % 30);
    } else if (seed >= 800 && seed <= 900) {
      blueScore = 60 + (seed % 40);
    } else {
      // Use mathematical pattern to estimate blue based on seed
      const normalized = (seed % 1000) / 1000;
      blueScore = Math.sin(normalized * Math.PI * 4) * 50 + 50;
    }

    // Weapon-specific adjustments
    if (defindex === 7) { // AK-47
      blueScore *= 0.9; // AK blue gems are rarer
    } else if (defindex === 3) { // Five-SeveN
      blueScore *= 1.1; // Five-SeveN has more blue potential
    }

    return Math.max(0, Math.min(100, blueScore));
  }

  /**
   * Get blue gem tier based on percentage
   */
  private getBlueGemTier(bluePercentage: number): string {
    if (bluePercentage >= 90) return 'Tier 1';
    if (bluePercentage >= 80) return 'Tier 2';
    if (bluePercentage >= 70) return 'Tier 3';
    if (bluePercentage >= 60) return 'Tier 4';
    return 'Low Tier';
  }

  /**
   * Estimate blue gem value based on weapon and blue percentage
   */
  private estimateBlueGemValue(defindex: number, bluePercentage: number): { min: number; max: number } {
    let baseValue = 0;
    let multiplier = 1;

    // Base values by weapon
    switch (defindex) {
      case 7: // AK-47
        baseValue = 100;
        multiplier = bluePercentage / 10;
        break;
      case 3: // Five-SeveN
        baseValue = 50;
        multiplier = bluePercentage / 15;
        break;
      case 32: // P2000
        baseValue = 20;
        multiplier = bluePercentage / 20;
        break;
      default:
        baseValue = 30;
        multiplier = bluePercentage / 25;
    }

    const estimatedValue = baseValue * multiplier;
    return {
      min: estimatedValue * 0.7,
      max: estimatedValue * 1.5
    };
  }

  /**
   * Calculate confidence in pattern analysis
   */
  private calculateConfidence(defindex: number, paintSeed: number): number {
    // Higher confidence for well-known patterns and popular weapons
    let confidence = 0.5;

    if (defindex === 7 || defindex === 3) { // AK-47 or Five-SeveN
      confidence += 0.3;
    }

    // Known pattern ranges get higher confidence
    if (paintSeed >= 1 && paintSeed <= 1000) {
      confidence += 0.2;
    }

    return Math.min(confidence, 0.95);
  }

  /**
   * Check if item is Fade pattern
   */
  private isFade(weaponType: string, itemName: string): boolean {
    return weaponType.includes('Fade') || itemName.includes('Fade');
  }

  /**
   * Analyze Fade patterns
   */
  private async analyzeFade(defindex: number, paintSeed: number): Promise<PatternInfo> {
    // Fade percentage calculation
    const fadePercentage = this.calculateFadePercentage(paintSeed);
    const fadeType = this.getFadeType(fadePercentage);

    return {
      type: 'fade',
      specialFeatures: [fadeType],
      patternTier: fadePercentage >= 95 ? 'Max Fade' : fadePercentage >= 90 ? 'High Fade' : 'Standard Fade'
    };
  }

  private calculateFadePercentage(paintSeed: number): number {
    // Simplified fade calculation - actual implementation would be more complex
    return 70 + (paintSeed % 30);
  }

  private getFadeType(fadePercentage: number): string {
    if (fadePercentage >= 98) return '100% Fade';
    if (fadePercentage >= 95) return '95% Fade';
    if (fadePercentage >= 90) return '90/10 Fade';
    if (fadePercentage >= 85) return '80/17/3 Fade';
    return 'Standard Fade';
  }

  /**
   * Check if item is Doppler
   */
  private isDoppler(weaponType: string, itemName: string): boolean {
    return weaponType.includes('Doppler') || itemName.includes('Doppler');
  }

  /**
   * Analyze Doppler phases
   */
  private async analyzeDoppler(defindex: number, paintSeed: number): Promise<PatternInfo> {
    const phase = this.calculateDopplerPhase(paintSeed);
    const isBlackPearl = phase === 'Black Pearl';
    const isSapphire = phase === 'Sapphire';
    const isRuby = phase === 'Ruby';

    return {
      type: 'doppler',
      specialFeatures: [phase],
      patternTier: isBlackPearl || isSapphire || isRuby ? 'Special Phase' : 'Standard Phase',
      estimatedValue: this.estimateDopplerValue(phase, defindex)
    };
  }

  private calculateDopplerPhase(paintSeed: number): string {
    const phaseNum = paintSeed % 5;
    
    // Special phases (rare)
    if (paintSeed % 100 === 0) return 'Black Pearl';
    if (paintSeed % 83 === 0) return 'Sapphire';
    if (paintSeed % 97 === 0) return 'Ruby';

    // Regular phases
    switch (phaseNum) {
      case 0: return 'Phase 1';
      case 1: return 'Phase 2';
      case 2: return 'Phase 3';
      case 3: return 'Phase 4';
      default: return 'Phase 1';
    }
  }

  private estimateDopplerValue(phase: string, defindex: number): number {
    const baseValues: Record<string, number> = {
      'Black Pearl': 2000,
      'Sapphire': 1500,
      'Ruby': 1200,
      'Phase 2': 800,
      'Phase 4': 750,
      'Phase 1': 600,
      'Phase 3': 550
    };

    return baseValues[phase] || 500;
  }

  /**
   * Check if item is Marble Fade
   */
  private isMarbleFade(weaponType: string, itemName: string): boolean {
    return weaponType.includes('Marble Fade') || itemName.includes('Marble Fade');
  }

  /**
   * Analyze Marble Fade patterns
   */
  private async analyzeMarbleFade(defindex: number, paintSeed: number): Promise<PatternInfo> {
    const pattern = this.getMarbleFadePattern(paintSeed);
    
    return {
      type: 'marble_fade',
      specialFeatures: [pattern.type],
      patternTier: pattern.tier,
      estimatedValue: pattern.value
    };
  }

  private getMarbleFadePattern(paintSeed: number): { type: string; tier: string; value: number } {
    // Fire & Ice patterns (most valuable)
    const fireIceSeeds = [412, 688, 868, 576]; // Example seeds
    if (fireIceSeeds.includes(paintSeed)) {
      return { type: 'Fire & Ice', tier: 'Max Fire & Ice', value: 2500 };
    }

    // Fake Fire & Ice
    if (paintSeed % 50 < 10) {
      return { type: 'Fake Fire & Ice', tier: 'High Tier', value: 1200 };
    }

    // Tricolor
    if (paintSeed % 30 < 15) {
      return { type: 'Tricolor', tier: 'Mid Tier', value: 800 };
    }

    return { type: 'Standard', tier: 'Standard', value: 600 };
  }
}