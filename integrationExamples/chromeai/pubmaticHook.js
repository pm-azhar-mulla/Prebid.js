/**
 * PubMatic Hook-based Extension for Prebid.js
 * This file implements the same functionality as PubMatic RTD Provider
 * but using Prebid's hook system instead of the RTD module
 */

(function() {
  // Get namespace from the script's URL parameter 'ns', default to 'pbjs' if not present
  function getNamespace() {
    // Get the current script URL
    let scriptUrl = '';
    // Find the current script element
    const scripts = document.getElementsByTagName('script');
    const currentScript = document.currentScript; // modern browsers
    
    if (currentScript) {
      scriptUrl = currentScript.src;
    } else {
      // Fallback for older browsers: find the last script loaded
      // This is not perfect but works in most cases
      const lastScript = scripts[scripts.length - 1];
      scriptUrl = lastScript.src;
    }
    
    try {
      // Parse the URL to extract parameters
      const url = new URL(scriptUrl);
      return url.searchParams.get('ns') || 'pbjs';
    } catch (e) {
      // Fallback if URL parsing fails
      const match = scriptUrl.match(/[?&]ns=([^&#]*)/i);
      return match ? match[1] : 'pbjs';
    }
  }
  
  // Store the namespace - this will be used throughout the code
  const NAMESPACE = getNamespace();
  // Constants
  const CONSTANTS = {
    LOG_PREFIX: 'PubMatic Hook: ',
    DEFAULT_TIMEOUT: 1000,
    LOCAL_FILES: {
      CONFIG: './config.json',
      FLOORS: './floors.json'
    }
  };

  // Create namespace queue immediately if it doesn't exist
  window[NAMESPACE] = window[NAMESPACE] || {};
  window[NAMESPACE].que = window[NAMESPACE].que || [];
  
  // Log the namespace being used
  console.log(`PubMatic Hook: Using namespace '${NAMESPACE}'`);
  
  // Flag to track if hook is registered
  let hookRegistered = false;

  // Helper functions
  function logInfo(message) {
    console.log(CONSTANTS.LOG_PREFIX + message);
  }

  function logError(message, error) {
    console.error(CONSTANTS.LOG_PREFIX + message, error);
  }

  // Schema field functions - same as RTD provider
  function getCurrentTimeOfDay() {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 18) return 'afternoon';
    return 'evening';
  }

  function getDeviceType() {
    try {
      // Simple mobile detection
      const userAgent = navigator.userAgent || navigator.vendor || window.opera;
      if (/android|iPad|iPhone|iPod/i.test(userAgent)) return 'mobile';
      return 'desktop';
    } catch (e) {
      return 'unknown';
    }
  }

  function getBrowserType() {
    try {
      const userAgent = navigator.userAgent;
      if (userAgent.indexOf('Chrome') > -1) return 'chrome';
      if (userAgent.indexOf('Safari') > -1) return 'safari';
      if (userAgent.indexOf('Firefox') > -1) return 'firefox';
      if (userAgent.indexOf('MSIE') > -1 || userAgent.indexOf('Trident/') > -1) return 'ie';
      if (userAgent.indexOf('Edge') > -1) return 'edge';
      return 'other';
    } catch (e) {
      return 'unknown';
    }
  }

  function getOs() {
    try {
      const userAgent = navigator.userAgent;
      if (userAgent.indexOf('Windows') > -1) return 'windows';
      if (userAgent.indexOf('Mac') > -1) return 'mac';
      if (userAgent.indexOf('Linux') > -1) return 'linux';
      if (userAgent.indexOf('Android') > -1) return 'android';
      if (userAgent.indexOf('iOS') > -1 || /iPad|iPhone|iPod/.test(userAgent)) return 'ios';
      return 'other';
    } catch (e) {
      return 'unknown';
    }
  }

  function getUtm() {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const utmParams = {};
      let hasUtm = false;
      
      ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].forEach(param => {
        const value = urlParams.get(param);
        if (value) {
          utmParams[param] = value;
          hasUtm = true;
        }
      });
      
      return hasUtm ? utmParams : undefined;
    } catch (e) {
      return undefined;
    }
  }

  function getCountry() {
    // In a real implementation, this might use stored user data or geolocation APIs
    // For this example, we'll return a hardcoded value
    return 'US';
  }

  function getBidder() {
    return function(bidRequest) {
      return bidRequest?.bidder;
    };
  }

  function getSupportScreen() {
    // Determine screen support level based on viewport width
    const width = window.innerWidth;
    return width > 1200 ? 'large' : width > 768 ? 'medium' : 'small';
  }

  // Data fetching - similar to RTD provider but simplified for hook approach
  async function fetchData(endpoint) {
    try {
      const response = await fetch(endpoint);
      
      if (!response.ok) {
        logError(`Error fetching data from ${endpoint}: ${response.status}`);
        return null;
      }
      
      return await response.json();
    } catch (error) {
      logError(`Error fetching data from ${endpoint}`, error);
      return null;
    }
  }

  // Process floor data similar to RTD provider
  function processFloorData(floorData, publisherId, profileId) {
    if (!floorData) return null;
    
    const defaultFloorConfig = {
      enforcement: {
        floorDeals: false,
        bidAdjustment: true
      }
    };
    
    // Add schema fields to floor data configuration
    const schemaFields = {
      ...(floorData.schema && floorData.schema.fields ? { fields: floorData.schema.fields } : {}),
    };
    
    return {
      floors: {
        ...defaultFloorConfig,
        data: {
          ...floorData,
          schema: schemaFields,
        },
        additionalSchemaFields: {
            deviceType: getDeviceType,
            timeOfDay: getCurrentTimeOfDay,
            browser: getBrowserType,
            os: getOs,
            utm: getUtm,
            country: getCountry,
            bidder: getBidder,
            supportScreen: getSupportScreen
          }
      }
    };
  }

  function postPubmaticRequestBidsHook(next, reqBidsConfigObj) {
    logInfo('Post Floor Hook executed');
    // Always continue the auction process
    return next(reqBidsConfigObj);
  }
  // Main hook function implementation
  async function pubmaticRequestBidsHook(next, reqBidsConfigObj) {
    reqBidsConfigObj.dummyValue = 'dummyValue';
    logInfo('Pre Floor Hook executed');
    console.log({reqBidsConfigObj});
    
    try {
      // Get configuration from Prebid
      const pubmaticConfig = window[NAMESPACE].getConfig('pubmatic') || {};
      const publisherId = pubmaticConfig.publisherId;
      const profileId = pubmaticConfig.profileId;
      
      if (!publisherId || !profileId) {
        logInfo('Missing publisherId or profileId, continuing auction without modifications');
        return next(reqBidsConfigObj);
      }
      
      // Fetch floor data (in production this would be from an API)
      const floorData = await fetchData(CONSTANTS.LOCAL_FILES.FLOORS);
      
      if (floorData) {
        // Process floor data
        const floorConfig = processFloorData(floorData, publisherId, profileId);
        
        if (floorConfig) {
          // Apply floor configuration
          window[NAMESPACE].que.push(function() {
            window[NAMESPACE].setConfig({ 
              floors: floorConfig.floors
            });
            logInfo('Applied floor configuration');
          });
        }
      }
      
      // Check for country data to add to ortb2
      const country = getCountry();
      if (country) {
        // Add country data to ortb2
        const ortb2 = {
          user: {
            ext: {
              ctr: country,
            }
          }
        };
        
        // Merge with existing ortb2 fragments
        if (!reqBidsConfigObj.ortb2Fragments) {
          reqBidsConfigObj.ortb2Fragments = {};
        }
        
        if (!reqBidsConfigObj.ortb2Fragments.bidder) {
          reqBidsConfigObj.ortb2Fragments.bidder = {};
        }
        
        // Add data only for PubMatic
        reqBidsConfigObj.ortb2Fragments.bidder.pubmatic = {
          ...reqBidsConfigObj.ortb2Fragments.bidder.pubmatic,
          ...ortb2
        };
        
        logInfo('Added country data to ortb2');
      }
    } catch (error) {
      logError('Error in hook execution', error);
    }
    
    // Always continue the auction process
    return next(reqBidsConfigObj);
  }

  // Initialize and register the hook
  function initPubmaticHook() {
    logInfo("Azzi123 > 1");
    if (window[NAMESPACE] && window[NAMESPACE].que) {
        logInfo("Azzi123 > 2");
      window[NAMESPACE].que.push(function() {
        logInfo("Azzi123 > 3");
        // Only register if not already registered
        if (!hookRegistered) {
          logInfo('Azzi123 Standard registration attempt');
          
          try {
            // Register the hook with a lower priority (higher number) to run after priceFloors (50)
            window[NAMESPACE].setConfig({floors: {enabled: true}});
            window[NAMESPACE].requestBids.before(pubmaticRequestBidsHook, 100);
            window[NAMESPACE].requestBids.before(postPubmaticRequestBidsHook, 10);

            hookRegistered = true;
            logInfo('Hook registered successfully (standard)');
          } catch (e) {
            logError('Error in standard hook registration', e);
          }
        } else {
          logInfo('Hook already registered, skipping standard registration');
        }
      });
    } else {
      logError('Prebid not found or not initialized');
    }
  }

  // Expose the initialization function
  window.PubmaticHook = {
    init: initPubmaticHook,
    namespace: NAMESPACE
  };
  
  // Early registration - do this as soon as the script loads
  // This should run before any requestBids calls
  (function registerEarly() {
    // Add to the beginning of the queue to ensure it runs before other commands
    window[NAMESPACE].que.unshift(function() {
      if (!hookRegistered) {
        logInfo('Azzi123 Early hook registration attempt');
        try {
          // Check if requestBids is available
          if (typeof window[NAMESPACE].requestBids === 'function' && 
              typeof window[NAMESPACE].requestBids.before === 'function') {
            window[NAMESPACE].requestBids.before(pubmaticRequestBidsHook, 100); // Higher priority number to run after priceFloors
            hookRegistered = true;
            logInfo('Hook registered successfully (early)');
          } else {
            // Will try again later
            logInfo('requestBids.before not available yet, will retry');
          }
        } catch (e) {
          logError('Error in early hook registration', e);
        }
      }
    });
  })();
  
  // Backup registration - in case the early registration didn't succeed
  // This uses a different mechanism to detect Prebid readiness
  (function setupBackupRegistration() {
    // Create a monitor that periodically checks if Prebid is ready
    const registerInterval = setInterval(function() {
      if (window[NAMESPACE] && 
          typeof window[NAMESPACE].requestBids === 'function' && 
          typeof window[NAMESPACE].requestBids.before === 'function' &&
          !hookRegistered) {
        
        try {
          window[NAMESPACE].requestBids.before(pubmaticRequestBidsHook, 100);
          hookRegistered = true;
          logInfo('Hook registered successfully (backup)');
          clearInterval(registerInterval);
        } catch (e) {
          logError('Error in backup hook registration', e);
        }
      }
    }, 50); // Check every 50ms
    
    // Clear interval after 10 seconds as a safeguard
    setTimeout(function() {
      clearInterval(registerInterval);
      if (!hookRegistered) {
        logError('Failed to register hook after timeout period');
      }
    }, 10000);
  })();
  
  // Also add the standard initialization
  initPubmaticHook();
})();
