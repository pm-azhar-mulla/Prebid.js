import { config } from '../src/config.js';
import { logInfo } from '../src/utils.js';

const MODULE_NAME = 'owCustomizedAds';

/**
 * Handles sticky ads functionality
 * @param {Object} stickyConfig - The sticky ads configuration
 * @param {boolean} stickyConfig.enabled - Whether sticky ads are enabled
 * @param {Array<string>} stickyConfig.divs - Array of div IDs to make sticky
 */
function handleStickyAds(stickyConfig) {
  if (!stickyConfig.enabled || !stickyConfig.divs || !stickyConfig.divs.length) return;
  
  // Create CSS selector from all divs in one go
  const divSelector = stickyConfig.divs.map(div => `#${div} :first-child`).join(',');

  // Create and append style element in a more streamlined way
  const style = document.createElement('style');
  style.type = 'text/css';
  const css = `${divSelector} {position: sticky;top: 5px;}`;
  
  // Handle different browser compatibility in a cleaner way
  style.styleSheet ? style.styleSheet.cssText = css : style.appendChild(document.createTextNode(css));
  
  // Append to head
  (document.head || document.getElementsByTagName('head')[0]).appendChild(style);
  
}

/**
 * Handles carousel ads functionality
 * @param {Object} carouselConfig - The carousel ads configuration
 * @param {boolean} carouselConfig.enabled - Whether carousel ads are enabled
 * @param {string} carouselConfig.adUnitCode - The ad unit code
 * @param {string} carouselConfig.divId - The div ID for the carousel
 * @param {number} carouselConfig.duration - The duration between slides
 * @param {number} carouselConfig.slidesCount - The number of slides in the carousel
 */
function handleCarouselAds(carouselConfig) {
  if (!carouselConfig.enabled) return;
  
  logInfo(`${MODULE_NAME} : Setting up carousel ads with config:`, carouselConfig);
  // This is a dummy function that will be expanded later
  // It will handle the carousel ads functionality
}

function handleConfig(config) {
  config = config.owCustomizedAds;
  logInfo(`${MODULE_NAME} : Setting config`);
  
  // Only process if we have a valid config
  if (!config) return;
  
  // Define feature handlers mapping
  const featureHandlers = {
    stickyAds: handleStickyAds,
    carouselAds: handleCarouselAds
  };
  
  // Process each feature if it exists in the config
  Object.keys(featureHandlers).forEach(feature => {
    if (config[feature]) {
      featureHandlers[feature](config[feature]);
    }
  });
}

// handleSetDebugConfig will be called whenever setConfig is called with debug property
config.getConfig('owCustomizedAds', config => handleConfig(config));