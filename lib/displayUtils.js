/**
 * Display utilities for CS2 float extension
 */

/**
 * Create Doppler phase display element
 */
function createDopplerDisplay(dopplerPhase) {
  if (!dopplerPhase) return '';

  const phaseColors = {
    'Ruby': '#ff0000',
    'Sapphire': '#0066ff',
    'Black Pearl': '#1a1a1a',
    'Emerald': '#00ff00',
    'Phase 1': '#8b4513',
    'Phase 2': '#ff69b4',
    'Phase 3': '#00ced1',
    'Phase 4': '#ffd700'
  };

  const color = phaseColors[dopplerPhase] || '#ffffff';

  return `
    <div class="cs2-doppler-copyable" style="
      color: ${color};
      font-weight: bold;
      cursor: pointer;
      transition: background-color 0.2s ease;
      text-shadow: 0 0 2px rgba(0,0,0,0.8);
    " title="Click to copy Doppler phase">
      ◆ ${dopplerPhase}
    </div>
  `;
}

/**
 * Create fade percentage display element
 */
function createFadeDisplay(fadePercentage) {
  if (!fadePercentage) return '';

  const getColor = (percentage) => {
    if (percentage >= 95) return '#ff0000'; // Full fade - red
    if (percentage >= 90) return '#ff4500'; // High fade - orange-red
    if (percentage >= 80) return '#ffa500'; // Good fade - orange
    if (percentage >= 70) return '#ffff00'; // Medium fade - yellow
    return '#90ee90'; // Low fade - light green
  };

  return `
    <div class="cs2-fade-copyable" style="
      color: ${getColor(fadePercentage)};
      font-weight: bold;
      cursor: pointer;
      transition: background-color 0.2s ease;
    " title="Click to copy fade percentage">
      🎨 ${fadePercentage}% Fade
    </div>
  `;
}

/**
 * Create ranking display element
 */
function createRankingDisplay(lowRank, highRank) {
  if (!lowRank && !highRank) return '';

  const rank = lowRank || highRank;
  const rankType = lowRank ? 'Low' : 'High';

  const getRankColor = (rank) => {
    if (rank <= 10) return '#ff0000';    // Top 10 - red
    if (rank <= 50) return '#ffa500';    // Top 50 - orange
    if (rank <= 100) return '#ffff00';   // Top 100 - yellow
    if (rank <= 500) return '#90ee90';   // Top 500 - light green
    return '#ffffff';                    // Others - white
  };

  return `
    <div class="cs2-rank-copyable" style="
      color: ${getRankColor(rank)};
      font-weight: bold;
      cursor: pointer;
      transition: background-color 0.2s ease;
    " title="Click to copy ranking">
      🏆 #${rank} ${rankType}
    </div>
  `;
}

/**
 * Create sticker details display element
 */
function createStickerDisplay(stickers) {
  if (!stickers || stickers.length === 0) return '';

  const stickerElements = stickers.map((sticker, index) => {
    const wearDisplay = sticker.wear !== undefined ? ` (${(sticker.wear * 100).toFixed(1)}% wear)` : '';
    return `
      <div class="cs2-sticker-copyable" style="
        font-size: 10px;
        opacity: 0.9;
        cursor: pointer;
        transition: background-color 0.2s ease;
        margin: 1px 0;
      " title="Click to copy sticker info">
        🏷️ ${sticker.name}${wearDisplay}
      </div>
    `;
  }).join('');

  return `
    <div style="margin-top: 4px;">
      ${stickerElements}
    </div>
  `;
}

/**
 * Create keychain/charm display element
 */
function createKeychainDisplay(keychains) {
  if (!keychains || keychains.length === 0) return '';

  const keychainElements = keychains.map((keychain, index) => {
    return `
      <div class="cs2-keychain-copyable" style="
        font-size: 10px;
        opacity: 0.9;
        cursor: pointer;
        transition: background-color 0.2s ease;
        margin: 1px 0;
      " title="Click to copy keychain info">
        🔑 ${keychain.name}
      </div>
    `;
  }).join('');

  return `
    <div style="margin-top: 4px;">
      ${keychainElements}
    </div>
  `;
}

// Export functions for use in content.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    createDopplerDisplay,
    createFadeDisplay,
    createRankingDisplay,
    createStickerDisplay,
    createKeychainDisplay
  };
}