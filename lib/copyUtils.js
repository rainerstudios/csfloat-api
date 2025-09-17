/**
 * Copy utilities for CS2 float extension
 */

/**
 * Copy text to clipboard and show feedback
 */
async function copyToClipboard(text, element) {
  try {
    await navigator.clipboard.writeText(text);

    // Show visual feedback
    const originalBg = element.style.backgroundColor;
    element.style.backgroundColor = 'rgba(34, 197, 94, 0.3)';

    setTimeout(() => {
      element.style.backgroundColor = originalBg;
    }, 300);

    // Optional: Show tooltip or notification
    showCopyFeedback(element, 'Copied!');
  } catch (err) {
    console.error('Failed to copy text: ', err);
    showCopyFeedback(element, 'Copy failed');
  }
}

/**
 * Show copy feedback tooltip
 */
function showCopyFeedback(element, message) {
  const tooltip = document.createElement('div');
  tooltip.textContent = message;
  tooltip.style.cssText = `
    position: absolute;
    background: #333;
    color: white;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 11px;
    z-index: 10000;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.2s;
  `;

  document.body.appendChild(tooltip);

  const rect = element.getBoundingClientRect();
  tooltip.style.left = rect.left + 'px';
  tooltip.style.top = (rect.top - 30) + 'px';

  // Fade in
  setTimeout(() => tooltip.style.opacity = '1', 10);

  // Remove after delay
  setTimeout(() => {
    tooltip.style.opacity = '0';
    setTimeout(() => document.body.removeChild(tooltip), 200);
  }, 1000);
}

/**
 * Add copy functionality to elements
 */
function addCopyListeners(container, floatData) {
  // Float value copy
  const floatElement = container.querySelector('.cs2-float-copyable');
  if (floatElement) {
    floatElement.addEventListener('click', () => {
      copyToClipboard(floatData.floatValue.toString(), floatElement);
    });
  }

  // Pattern seed copy
  const patternElement = container.querySelector('.cs2-pattern-copyable');
  if (patternElement) {
    patternElement.addEventListener('click', () => {
      copyToClipboard(floatData.paintSeed.toString(), patternElement);
    });
  }

  // Investment score copy
  const scoreElement = container.querySelector('.cs2-score-copyable');
  if (scoreElement) {
    scoreElement.addEventListener('click', () => {
      copyToClipboard(floatData.investmentScore.toString(), scoreElement);
    });
  }

  // Doppler phase copy
  const dopplerElement = container.querySelector('.cs2-doppler-copyable');
  if (dopplerElement && floatData.dopplerPhase) {
    dopplerElement.addEventListener('click', () => {
      copyToClipboard(floatData.dopplerPhase, dopplerElement);
    });
  }

  // Fade percentage copy
  const fadeElement = container.querySelector('.cs2-fade-copyable');
  if (fadeElement && floatData.fadePercentage) {
    fadeElement.addEventListener('click', () => {
      copyToClipboard(`${floatData.fadePercentage}%`, fadeElement);
    });
  }

  // Ranking copy
  const rankElement = container.querySelector('.cs2-rank-copyable');
  if (rankElement && (floatData.lowRank || floatData.highRank)) {
    rankElement.addEventListener('click', () => {
      const rank = floatData.lowRank || floatData.highRank;
      const rankType = floatData.lowRank ? 'Low' : 'High';
      copyToClipboard(`#${rank} ${rankType}`, rankElement);
    });
  }

  // Sticker copy
  const stickerElements = container.querySelectorAll('.cs2-sticker-copyable');
  if (stickerElements.length > 0 && floatData.stickers) {
    stickerElements.forEach((element, index) => {
      if (floatData.stickers[index]) {
        element.addEventListener('click', () => {
          const sticker = floatData.stickers[index];
          const wearText = sticker.wear !== undefined ? ` (${(sticker.wear * 100).toFixed(1)}% wear)` : '';
          copyToClipboard(`${sticker.name}${wearText}`, element);
        });
      }
    });
  }

  // Keychain copy
  const keychainElements = container.querySelectorAll('.cs2-keychain-copyable');
  if (keychainElements.length > 0 && floatData.keychains) {
    keychainElements.forEach((element, index) => {
      if (floatData.keychains[index]) {
        element.addEventListener('click', () => {
          copyToClipboard(floatData.keychains[index].name, element);
        });
      }
    });
  }
}

// Export functions for use in content.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    copyToClipboard,
    showCopyFeedback,
    addCopyListeners
  };
}