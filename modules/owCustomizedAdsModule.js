import { config } from '../src/config.js';
import { logInfo } from '../src/utils.js';

const MODULE_NAME = 'owCustomizedAds';

function handleConfig(config) {
  config = config.OWCustomizedAds;
  logInfo(`${MODULE_NAME} : Setting config`);
  if (config && config.stickyAds && config.stickyAds.enabled) {
    var divs = config.stickyAds.divs;
    var divSelector = '';
    divs.forEach(function(iDiv) {
      divSelector += `#${iDiv} > iframe,`;
    })
    divSelector = divSelector.slice(0, -1);
    let css = `${divSelector} {position: sticky;top: 20px;}`;
    let head = document.head || document.getElementsByTagName('head')[0];
    let style = document.createElement('style');

    head.appendChild(style);

    style.type = 'text/css';

    if (style.styleSheet) {
      // This is required for IE8 and below.
      style.styleSheet.cssText = css;
    } else {
      style.appendChild(document.createTextNode(css));
    }
  }
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
