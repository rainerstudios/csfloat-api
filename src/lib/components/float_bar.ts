/**
 * Visual Float Bar Component
 * Creates rich visual representations of float values
 */

import { EnhancedFloatData, WEAR_RANGES } from '@/types/float_data';

export interface FloatBarOptions {
  width?: number;
  height?: number;
  showLabels?: boolean;
  showPercentile?: boolean;
  showTicks?: boolean;
  style?: 'modern' | 'minimal' | 'detailed';
  theme?: 'light' | 'dark' | 'steam';
}

export class FloatBarComponent {
  private container: HTMLElement;
  private options: Required<FloatBarOptions>;

  constructor(container: HTMLElement, options: FloatBarOptions = {}) {
    this.container = container;
    this.options = {
      width: options.width ?? 300,
      height: options.height ?? 40,
      showLabels: options.showLabels ?? true,
      showPercentile: options.showPercentile ?? true,
      showTicks: options.showTicks ?? true,
      style: options.style ?? 'modern',
      theme: options.theme ?? 'dark'
    };
  }

  /**
   * Render float bar with enhanced data
   */
  render(floatData: EnhancedFloatData): void {
    const wrapper = this.createWrapper();
    
    // Main float bar
    const floatBar = this.createFloatBar(floatData);
    wrapper.appendChild(floatBar);

    // Labels and info
    if (this.options.showLabels) {
      const labels = this.createLabels(floatData);
      wrapper.appendChild(labels);
    }

    // Percentile indicator
    if (this.options.showPercentile && floatData.floatPercentile) {
      const percentile = this.createPercentileIndicator(floatData);
      wrapper.appendChild(percentile);
    }

    // Clear existing content and add new
    this.container.innerHTML = '';
    this.container.appendChild(wrapper);
  }

  private createWrapper(): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = `cs2-float-bar-wrapper cs2-float-bar-${this.options.style} cs2-float-bar-${this.options.theme}`;
    wrapper.style.cssText = `
      width: ${this.options.width}px;
      position: relative;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      margin: 8px 0;
    `;
    return wrapper;
  }

  private createFloatBar(floatData: EnhancedFloatData): HTMLElement {
    const bar = document.createElement('div');
    bar.className = 'cs2-float-bar';
    
    const wearRanges = this.getWearRangeSegments();
    const floatPosition = this.calculateFloatPosition(floatData.floatValue);
    
    bar.style.cssText = `
      width: 100%;
      height: ${this.options.height}px;
      background: ${this.createGradientBackground()};
      border-radius: 6px;
      position: relative;
      box-shadow: inset 0 2px 4px rgba(0,0,0,0.1);
      overflow: hidden;
    `;

    // Add wear range dividers
    if (this.options.showTicks) {
      const ticks = this.createWearTicks();
      bar.appendChild(ticks);
    }

    // Float indicator
    const indicator = this.createFloatIndicator(floatData, floatPosition);
    bar.appendChild(indicator);

    // Hover tooltip
    this.addTooltip(bar, floatData);

    return bar;
  }

  private getWearRangeSegments() {
    return [
      { name: 'FN', range: [0.00, 0.07], color: '#4CAF50' },
      { name: 'MW', range: [0.07, 0.15], color: '#8BC34A' },
      { name: 'FT', range: [0.15, 0.38], color: '#FF9800' },
      { name: 'WW', range: [0.38, 0.45], color: '#FF5722' },
      { name: 'BS', range: [0.45, 1.00], color: '#795548' }
    ];
  }

  private calculateFloatPosition(floatValue: number): number {
    // Convert float value (0-1) to pixel position
    return (floatValue * this.options.width);
  }

  private createGradientBackground(): string {
    const segments = this.getWearRangeSegments();
    const colors = segments.map((segment, index) => {
      const position = (segment.range[1] * 100).toFixed(1);
      return `${segment.color} ${position}%`;
    });
    
    return `linear-gradient(to right, ${colors.join(', ')})`;
  }

  private createWearTicks(): HTMLElement {
    const ticks = document.createElement('div');
    ticks.className = 'cs2-float-ticks';
    ticks.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
    `;

    const wearBoundaries = [0.07, 0.15, 0.38, 0.45];
    
    wearBoundaries.forEach(boundary => {
      const tick = document.createElement('div');
      tick.style.cssText = `
        position: absolute;
        left: ${boundary * 100}%;
        top: 0;
        width: 2px;
        height: 100%;
        background: rgba(255, 255, 255, 0.3);
        box-shadow: 0 0 2px rgba(0,0,0,0.5);
      `;
      ticks.appendChild(tick);
    });

    return ticks;
  }

  private createFloatIndicator(floatData: EnhancedFloatData, position: number): HTMLElement {
    const indicator = document.createElement('div');
    indicator.className = 'cs2-float-indicator';
    
    const isTopTier = floatData.floatPercentile && floatData.floatPercentile >= 90;
    const indicatorColor = isTopTier ? '#FFD700' : '#FFFFFF';
    
    indicator.style.cssText = `
      position: absolute;
      left: ${position}px;
      top: 50%;
      transform: translateX(-50%) translateY(-50%);
      width: 12px;
      height: 12px;
      background: ${indicatorColor};
      border: 2px solid rgba(0,0,0,0.8);
      border-radius: 50%;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      z-index: 10;
      cursor: pointer;
      transition: all 0.2s ease;
    `;

    // Glow effect for top tier floats
    if (isTopTier) {
      indicator.style.boxShadow = `
        0 0 10px ${indicatorColor},
        0 2px 8px rgba(0,0,0,0.3)
      `;
    }

    // Hover effect
    indicator.addEventListener('mouseenter', () => {
      indicator.style.transform = 'translateX(-50%) translateY(-50%) scale(1.2)';
    });

    indicator.addEventListener('mouseleave', () => {
      indicator.style.transform = 'translateX(-50%) translateY(-50%) scale(1)';
    });

    return indicator;
  }

  private createLabels(floatData: EnhancedFloatData): HTMLElement {
    const labels = document.createElement('div');
    labels.className = 'cs2-float-labels';
    labels.style.cssText = `
      display: flex;
      justify-content: space-between;
      margin-top: 8px;
      font-size: 11px;
      color: ${this.options.theme === 'dark' ? '#B0B3B8' : '#65676B'};
    `;

    // Wear condition labels
    const wearLabels = ['Factory New', 'Minimal Wear', 'Field-Tested', 'Well-Worn', 'Battle-Scarred'];
    const positions = [0, 7, 15, 38, 45, 100];

    wearLabels.forEach((label, index) => {
      const labelEl = document.createElement('span');
      labelEl.textContent = label;
      labelEl.style.cssText = `
        position: absolute;
        left: ${positions[index]}%;
        transform: translateX(-50%);
        font-size: 9px;
        opacity: 0.7;
        white-space: nowrap;
      `;
      
      if (this.isCurrentWear(floatData.floatValue, positions[index], positions[index + 1])) {
        labelEl.style.fontWeight = 'bold';
        labelEl.style.opacity = '1';
        labelEl.style.color = this.options.theme === 'dark' ? '#FFFFFF' : '#000000';
      }
      
      labels.appendChild(labelEl);
    });

    return labels;
  }

  private createPercentileIndicator(floatData: EnhancedFloatData): HTMLElement {
    const percentile = document.createElement('div');
    percentile.className = 'cs2-float-percentile';
    percentile.style.cssText = `
      margin-top: 8px;
      text-align: center;
      font-size: 12px;
      font-weight: 600;
    `;

    const percentileValue = floatData.floatPercentile!;
    const topPercent = 100 - percentileValue;
    
    let color = '#FF5722'; // Default red
    let message = `Bottom ${percentileValue.toFixed(1)}%`;

    if (percentileValue >= 95) {
      color = '#FFD700'; // Gold
      message = `🏆 Top ${topPercent.toFixed(1)}% (Exceptional!)`;
    } else if (percentileValue >= 90) {
      color = '#4CAF50'; // Green
      message = `⭐ Top ${topPercent.toFixed(1)}% (Excellent)`;
    } else if (percentileValue >= 75) {
      color = '#2196F3'; // Blue
      message = `👍 Top ${topPercent.toFixed(1)}% (Good)`;
    } else if (percentileValue >= 50) {
      color = '#FF9800'; // Orange
      message = `📊 Top ${topPercent.toFixed(1)}% (Average)`;
    }

    percentile.style.color = color;
    percentile.textContent = message;

    return percentile;
  }

  private isCurrentWear(floatValue: number, rangeStart: number, rangeEnd: number): boolean {
    const normalizedFloat = floatValue * 100;
    return normalizedFloat >= rangeStart && normalizedFloat < rangeEnd;
  }

  private addTooltip(bar: HTMLElement, floatData: EnhancedFloatData): void {
    let tooltip: HTMLElement | null = null;

    bar.addEventListener('mouseenter', (e) => {
      tooltip = this.createTooltip(floatData);
      document.body.appendChild(tooltip);
      this.positionTooltip(tooltip, e);
    });

    bar.addEventListener('mousemove', (e) => {
      if (tooltip) {
        this.positionTooltip(tooltip, e);
      }
    });

    bar.addEventListener('mouseleave', () => {
      if (tooltip) {
        tooltip.remove();
        tooltip = null;
      }
    });
  }

  private createTooltip(floatData: EnhancedFloatData): HTMLElement {
    const tooltip = document.createElement('div');
    tooltip.className = 'cs2-float-tooltip';
    tooltip.style.cssText = `
      position: fixed;
      background: rgba(42, 50, 58, 0.98);
      color: #c6d4df;
      padding: 12px;
      border-radius: 6px;
      border: 1px solid rgba(102, 119, 136, 0.4);
      font-size: 12px;
      z-index: 999999;
      pointer-events: none;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.8);
      max-width: 280px;
    `;

    const content = this.createTooltipContent(floatData);
    tooltip.innerHTML = content;

    return tooltip;
  }

  private createTooltipContent(floatData: EnhancedFloatData): string {
    const parts = [
      `<div style="font-weight: bold; color: #4CAF50; margin-bottom: 8px; border-bottom: 1px solid #333; padding-bottom: 4px;">
        ${floatData.weaponName} | ${floatData.skinName}
      </div>`,
      
      `<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin-bottom: 8px;">
        <div>Float Value:</div>
        <div style="color: #4CAF50; font-weight: bold; font-family: monospace;">${floatData.floatValue.toFixed(6)}</div>
        <div>Wear Condition:</div>
        <div>${floatData.wearName}</div>
        <div>Paint Seed:</div>
        <div>#${floatData.paintSeed}</div>
      </div>`
    ];

    if (floatData.floatPercentile) {
      const topPercent = 100 - floatData.floatPercentile;
      parts.push(`
        <div style="margin-bottom: 8px;">
          <div>Float Ranking:</div>
          <div style="color: #22c55e; font-weight: bold;">Top ${topPercent.toFixed(1)}% for this item</div>
        </div>
      `);
    }

    if (floatData.blueGemInfo) {
      parts.push(`
        <div style="margin-bottom: 8px; padding: 8px; background: rgba(33, 150, 243, 0.1); border-radius: 4px;">
          <div style="color: #2196F3; font-weight: bold;">🔷 Blue Gem Detected</div>
          <div>Blue Coverage: ${floatData.blueGemInfo.bluePercentage}%</div>
          <div>Tier: ${floatData.blueGemInfo.tier}</div>
          ${floatData.blueGemInfo.estimatedValue ? `
            <div>Est. Value: $${floatData.blueGemInfo.estimatedValue.min} - $${floatData.blueGemInfo.estimatedValue.max}</div>
          ` : ''}
        </div>
      `);
    }

    if (floatData.patternInfo && floatData.patternInfo.specialFeatures.length > 0) {
      parts.push(`
        <div style="margin-bottom: 8px;">
          <div>Special Features:</div>
          <div style="color: #8b5cf6;">${floatData.patternInfo.specialFeatures.join(', ')}</div>
        </div>
      `);
    }

    if (floatData.stickers.length > 0) {
      parts.push(`
        <div style="margin-bottom: 8px;">
          <div>Stickers: ${floatData.stickers.length}</div>
        </div>
      `);
    }

    if (floatData.statTrakKills !== undefined) {
      parts.push(`
        <div style="color: #FF6B35; font-weight: bold;">
          StatTrak™: ${floatData.statTrakKills} kills
        </div>
      `);
    }

    return parts.join('');
  }

  private positionTooltip(tooltip: HTMLElement, event: MouseEvent): void {
    const x = event.clientX + 10;
    const y = event.clientY - 10;
    
    const tooltipRect = tooltip.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    let finalX = x;
    let finalY = y;
    
    // Keep tooltip within viewport
    if (x + tooltipRect.width > viewportWidth) {
      finalX = event.clientX - tooltipRect.width - 10;
    }
    
    if (y + tooltipRect.height > viewportHeight) {
      finalY = event.clientY - tooltipRect.height - 10;
    }
    
    tooltip.style.left = `${finalX}px`;
    tooltip.style.top = `${finalY}px`;
  }
}