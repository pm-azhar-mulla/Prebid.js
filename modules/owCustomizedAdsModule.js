import { config } from '../src/config.js';
import { logInfo } from '../src/utils.js';

const MODULE_NAME = 'owCustomizedAds';

function handleConfig(config) {
  config = config.OWCustomizedAds;
  logInfo(`${MODULE_NAME} : Setting config`);
  
  // Only process if we have a valid config
  if (!config) return;
  
  // Define feature handlers
  const featureHandlers = {
    stickyAds: function(stickyConfig) {
      if (!stickyConfig.enabled || !stickyConfig.divs || !stickyConfig.divs.length) return;
      
      // Create CSS selector from all divs in one go
      const divSelector = stickyConfig.divs.map(div => `#${div} > iframe`).join(',');
      
      // Create and append style element in a more streamlined way
      const style = document.createElement('style');
      style.type = 'text/css';
      const css = `${divSelector} {position: sticky;top: 20px;}`;
      
      // Handle different browser compatibility in a cleaner way
      style.styleSheet ? style.styleSheet.cssText = css : style.appendChild(document.createTextNode(css));
      
      // Append to head
      (document.head || document.getElementsByTagName('head')[0]).appendChild(style);
    },
    
    carouselAds: function(carouselConfig) {
      if (!carouselConfig.enabled) return;
      handleCarouselAds(carouselConfig);
    }
  };
  
  // Process each feature if it exists in the config
  Object.keys(featureHandlers).forEach(feature => {
    if (config[feature]) {
      featureHandlers[feature](config[feature]);
    }
  });
}

/**
 * Dummy function to handle carousel ads
 * @param {Object} carouselConfig - The carousel ads configuration
 * @param {string} carouselConfig.adUnitCode - The ad unit code
 * @param {string} carouselConfig.divId - The div ID for the carousel
 * @param {number} carouselConfig.duration - The duration between slides
 * @param {number} carouselConfig.slidesCount - The number of slides in the carousel
 */
function handleCarouselAds(carouselConfig) {
  logInfo(`${MODULE_NAME} : Setting up carousel ads with config:`, carouselConfig);
  // This is a dummy function that will be expanded later
  // It will handle the carousel ads functionality
}

// handleSetDebugConfig will be called whenever setConfig is called with debug property
config.getConfig('owCustomizedAds', config => handleConfig(config));

// function onClickListener(){
//     var parentEle = document.getElementById("ParentDivScrolling");
//     var lastChildEle = parentEle.lastElementChild;
//     if(isSpaceAvailable(parentEle.getBoundingClientRect(), lastChildEle.getBoundingClientRect())){
//       var iDiv = document.createElement('div');
//       iDiv.id = "OWContainer"+(Math.floor(Math.random() * 1226) + 1)
//       iDiv.className = 'new-block';
//       // The variable iDiv is still good... Just append to it.
//       parentEle.appendChild(iDiv);

//       //googletag.display(iDiv.id);
//       //googletag.pubads().refresh(iDiv.id);

//       PWT.requestBids([{"code":`${iDiv.id}`,"divId":`${iDiv.id}`,"adUnitId":"/43743431/DMDemo","adUnitIndex":"0","mediaTypes":{"banner":{"sizes":[[300,250],[160,600]]}},"sizes":[[300,250],[160,600]]}],
//         function(adUnitsArray){
//                 console.log("AdUnitsArray",adUnitsArray);
//                 PWT.displayAllCreativesWithoutAdServer(adUnitsArray);
//             }
//       )
//       owpbjs.setConfig({
//         OWCustomizedAds:{
//           stickyAds: {
//             enabled: true,
//             divs: [iDiv.id]
//           },
//           carouselAds: {
//             enabled: true,
//             adUnitCode: "/43743431/DMDemo",
//             divId: iDiv.id,
//             duration: 3000,
//             slidesCount: 5
//           }
//          }
//       });
//     }
//    }

//    isSpaceAvailable = function(parentEle, childEle){
//       var requiredSpace = 900;
//       var avaiableSpace = parentEle.height - ((childEle.top - parentEle.top) + childEle.height);
//       console.log({requiredSpace},{avaiableSpace})
//       if(avaiableSpace > requiredSpace) { return true; } else { return false; }
//    }
