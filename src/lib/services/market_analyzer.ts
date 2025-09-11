/**
 * Market Analyzer - Provides market intelligence and pricing data
 */

import { MarketIntelligence, MarketTrend } from '@/types/float_data';

export class MarketAnalyzer {
  private cache = new Map<string, { data: MarketIntelligence; timestamp: number }>();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  /**
   * Get comprehensive market intelligence for an item
   */
  async getMarketIntelligence(itemName: string): Promise<MarketIntelligence | undefined> {
    // Check cache first
    const cached = this.cache.get(itemName);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.data;
    }

    try {
      // In production, this would integrate with multiple APIs:
      // - Steam Market API
      // - CSFloat Market API
      // - Third-party pricing APIs
      // - Historical database

      const marketData = await this.fetchMarketData(itemName);
      const intelligence = await this.analyzeMarketData(marketData, itemName);

      // Cache the result
      this.cache.set(itemName, { data: intelligence, timestamp: Date.now() });

      return intelligence;
    } catch (error) {
      console.error('Failed to get market intelligence:', error);
      return undefined;
    }
  }

  private async fetchMarketData(itemName: string): Promise<any> {
    // Mock market data - in production, integrate with real APIs
    const mockData = {
      currentPrice: this.generateMockPrice(itemName),
      volume: Math.floor(Math.random() * 1000) + 100,
      listings: Math.floor(Math.random() * 50) + 10,
      priceHistory: this.generatePriceHistory(itemName),
      demand: Math.random() * 100
    };

    return mockData;
  }

  private async analyzeMarketData(marketData: any, itemName: string): Promise<MarketIntelligence> {
    const currentPrice = marketData.currentPrice;
    const priceHistory = marketData.priceHistory;
    
    // Calculate trends
    const recentTrend = this.calculateTrend(priceHistory.slice(-7)); // Last 7 days
    const supplyEstimate = this.estimateSupply(marketData.listings);
    const demandTrend = this.analyzeDemand(marketData.demand, recentTrend);
    const investmentRating = this.calculateInvestmentRating(recentTrend, supplyEstimate, demandTrend);
    const priceTargets = this.calculatePriceTargets(currentPrice, recentTrend);
    const { riskFactors, opportunities } = this.assessMarketConditions(itemName, marketData);

    return {
      currentPrice,
      priceHistory,
      supplyEstimate,
      demandTrend,
      investmentRating,
      priceTarget: priceTargets,
      riskFactors,
      opportunities
    };
  }

  private generateMockPrice(itemName: string): number {
    // Generate realistic prices based on item characteristics
    let basePrice = 50;
    
    if (itemName.includes('AK-47')) basePrice = 100;
    if (itemName.includes('AWP')) basePrice = 200;
    if (itemName.includes('Karambit')) basePrice = 500;
    if (itemName.includes('Dragon Lore')) basePrice = 2000;
    
    if (itemName.includes('Factory New')) basePrice *= 2;
    if (itemName.includes('StatTrak')) basePrice *= 1.5;
    if (itemName.includes('Souvenir')) basePrice *= 3;
    
    // Add random variation
    const variation = 0.8 + Math.random() * 0.4; // ±20%
    return Math.round(basePrice * variation);
  }

  private generatePriceHistory(itemName: string): MarketTrend[] {
    const basePrice = this.generateMockPrice(itemName);
    const history: MarketTrend[] = [];
    const daysBack = 30;
    
    for (let i = daysBack; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      
      // Generate price with trend and random variation
      const trend = Math.sin(i / 10) * 0.1; // Slight upward trend
      const randomVariation = (Math.random() - 0.5) * 0.2; // ±10%
      const price = basePrice * (1 + trend + randomVariation);
      
      history.push({
        date: date.toISOString().split('T')[0],
        price: Math.round(price * 100) / 100,
        volume: Math.floor(Math.random() * 100) + 20,
        averageFloat: 0.15 + Math.random() * 0.3
      });
    }
    
    return history;
  }

  private calculateTrend(recentData: MarketTrend[]): number {
    if (recentData.length < 2) return 0;
    
    const firstPrice = recentData[0].price;
    const lastPrice = recentData[recentData.length - 1].price;
    
    return (lastPrice - firstPrice) / firstPrice;
  }

  private estimateSupply(listings: number): MarketIntelligence['supplyEstimate'] {
    if (listings < 10) return 'Very Low';
    if (listings < 25) return 'Low';
    if (listings < 50) return 'Medium';
    if (listings < 100) return 'High';
    return 'Very High';
  }

  private analyzeDemand(demandScore: number, priceTrend: number): MarketIntelligence['demandTrend'] {
    if (demandScore > 70 || priceTrend > 0.1) return 'Rising';
    if (demandScore < 30 || priceTrend < -0.1) return 'Falling';
    return 'Stable';
  }

  private calculateInvestmentRating(
    trend: number,
    supply: MarketIntelligence['supplyEstimate'],
    demand: MarketIntelligence['demandTrend']
  ): MarketIntelligence['investmentRating'] {
    let score = 0;
    
    // Trend score
    if (trend > 0.15) score += 2;
    else if (trend > 0.05) score += 1;
    else if (trend < -0.15) score -= 2;
    else if (trend < -0.05) score -= 1;
    
    // Supply score
    if (supply === 'Very Low') score += 2;
    else if (supply === 'Low') score += 1;
    else if (supply === 'High') score -= 1;
    else if (supply === 'Very High') score -= 2;
    
    // Demand score
    if (demand === 'Rising') score += 2;
    else if (demand === 'Falling') score -= 2;
    
    // Convert to rating
    if (score >= 4) return 'Strong Buy';
    if (score >= 2) return 'Buy';
    if (score <= -4) return 'Strong Sell';
    if (score <= -2) return 'Sell';
    return 'Hold';
  }

  private calculatePriceTargets(currentPrice: number, trend: number): MarketIntelligence['priceTarget'] {
    const trendMultiplier = 1 + trend;
    
    return {
      oneWeek: Math.round(currentPrice * Math.pow(trendMultiplier, 0.25) * 100) / 100,
      oneMonth: Math.round(currentPrice * trendMultiplier * 100) / 100,
      threeMonth: Math.round(currentPrice * Math.pow(trendMultiplier, 3) * 100) / 100
    };
  }

  private assessMarketConditions(itemName: string, marketData: any): {
    riskFactors: string[];
    opportunities: string[];
  } {
    const riskFactors: string[] = [];
    const opportunities: string[] = [];
    
    // Analyze risk factors
    if (marketData.listings > 100) {
      riskFactors.push('High supply may pressure prices downward');
    }
    
    if (marketData.volume < 50) {
      riskFactors.push('Low trading volume increases price volatility');
    }
    
    if (itemName.includes('Case Hardened')) {
      riskFactors.push('Pattern-dependent pricing creates valuation uncertainty');
    }
    
    // Analyze opportunities
    if (marketData.listings < 20) {
      opportunities.push('Low supply may drive price appreciation');
    }
    
    if (marketData.demand > 80) {
      opportunities.push('High demand indicates strong market interest');
    }
    
    if (itemName.includes('Factory New') && marketData.currentPrice < 100) {
      opportunities.push('Low float items often appreciate over time');
    }
    
    if (itemName.includes('StatTrak')) {
      opportunities.push('StatTrak items have dedicated collector base');
    }
    
    return { riskFactors, opportunities };
  }

  /**
   * Get simplified price recommendation
   */
  async getQuickRecommendation(itemName: string, currentFloat: number): Promise<{
    action: 'buy' | 'sell' | 'hold';
    confidence: number;
    reason: string;
  }> {
    const intelligence = await this.getMarketIntelligence(itemName);
    
    if (!intelligence) {
      return {
        action: 'hold',
        confidence: 0.5,
        reason: 'Insufficient market data'
      };
    }
    
    let action: 'buy' | 'sell' | 'hold' = 'hold';
    let confidence = 0.5;
    let reason = 'Market conditions are neutral';
    
    // Analyze investment rating
    if (intelligence.investmentRating === 'Strong Buy') {
      action = 'buy';
      confidence = 0.9;
      reason = 'Strong upward trend with favorable supply/demand';
    } else if (intelligence.investmentRating === 'Buy') {
      action = 'buy';
      confidence = 0.7;
      reason = 'Positive market indicators suggest price appreciation';
    } else if (intelligence.investmentRating === 'Strong Sell') {
      action = 'sell';
      confidence = 0.9;
      reason = 'Declining market with oversupply concerns';
    } else if (intelligence.investmentRating === 'Sell') {
      action = 'sell';
      confidence = 0.7;
      reason = 'Negative trend indicators suggest price decline';
    }
    
    // Adjust based on float value
    if (currentFloat < 0.01) {
      confidence += 0.1;
      if (action === 'buy') reason += ' (exceptional float adds premium)';
    }
    
    return { action, confidence: Math.min(confidence, 1), reason };
  }

  /**
   * Compare item against market average
   */
  async compareToMarket(itemName: string, floatValue: number): Promise<{
    pricePosition: 'well_below' | 'below' | 'average' | 'above' | 'well_above';
    floatPosition: 'excellent' | 'good' | 'average' | 'poor';
    overallValue: 'excellent' | 'good' | 'fair' | 'poor';
  }> {
    const intelligence = await this.getMarketIntelligence(itemName);
    
    // Mock comparison - in production, use real market data
    const avgFloat = 0.25;
    const avgPrice = intelligence?.currentPrice || 100;
    
    let pricePosition: any = 'average';
    let floatPosition: any = 'average';
    
    // Analyze float position
    if (floatValue < 0.01) floatPosition = 'excellent';
    else if (floatValue < 0.07) floatPosition = 'good';
    else if (floatValue > 0.5) floatPosition = 'poor';
    
    // Determine overall value
    let overallValue: any = 'fair';
    if (floatPosition === 'excellent' && pricePosition !== 'well_above') {
      overallValue = 'excellent';
    } else if (floatPosition === 'good' && pricePosition === 'below') {
      overallValue = 'good';
    }
    
    return { pricePosition, floatPosition, overallValue };
  }
}