import { getGlobal } from "../src/prebidGlobal";
import { logWarn, logInfo, isNumber, isFunction, isEmpty } from "../src/utils";

const LOG_WARN_PREFIX = 'OpenWrapConvert: ';
window.PWT = window.PWT || {};

window.PWT.renderAllAdUnits = function () {
    var winners = pbjs.getHighestCpmBids();
    for (var i = 0; i < winners.length; i++) {
        window.PWT.renderOne(winners[i]);
    }
}

window.PWT.renderOne = function (winningBid) {
    if (winningBid && winningBid.adId) {
        var div = document.getElementById(winningBid.adUnitCode);
        if (div) {
            var oldIframe = document.getElementById("prebid_ads_iframe_" + winningBid.adUnitCode);
            if (oldIframe) {
                oldIframe.remove();
            }
            const iframe = document.createElement('iframe');
            iframe.scrolling = 'no';
            iframe.frameBorder = '0';
            iframe.marginHeight = '0';
            iframe.marginHeight = '0';
            iframe.name = `prebid_ads_iframe_${winningBid.adUnitCode}`;
            iframe.id = `prebid_ads_iframe_${winningBid.adUnitCode}`;
            iframe.title = '3rd party ad content';
            iframe.sandbox.add(
                'allow-forms',
                'allow-popups',
                'allow-popups-to-escape-sandbox',
                'allow-same-origin',
                'allow-scripts',
                'allow-top-navigation-by-user-activation'
            );
            iframe.setAttribute('aria-label', 'Advertisment');
            iframe.style.setProperty('border', '0');
            iframe.style.setProperty('margin', '0');
            iframe.style.setProperty('overflow', 'hidden');
            div.appendChild(iframe);
            const iframeDoc = iframe.contentWindow.document;
            pbjs.renderAd(iframeDoc, winningBid.adId);
            const normalizeCss = `/*! normalize.css v8.0.1 | MIT License | github.com/necolas/normalize.css */button,hr,input{overflow:visible}progress,sub,sup{vertical-align:baseline}[type=checkbox],[type=radio],legend{box-sizing:border-box;padding:0}html{line-height:1.15;-webkit-text-size-adjust:100%}body{margin:0}details,main{display:block}h1{font-size:2em;margin:.67em 0}hr{box-sizing:content-box;height:0}code,kbd,pre,samp{font-family:monospace,monospace;font-size:1em}a{background-color:transparent}abbr[title]{border-bottom:none;text-decoration:underline;text-decoration:underline dotted}b,strong{font-weight:bolder}small{font-size:80%}sub,sup{font-size:75%;line-height:0;position:relative}sub{bottom:-.25em}sup{top:-.5em}img{border-style:none}button,input,optgroup,select,textarea{font-family:inherit;font-size:100%;line-height:1.15;margin:0}button,select{text-transform:none}[type=button],[type=reset],[type=submit],button{-webkit-appearance:button}[type=button]::-moz-focus-inner,[type=reset]::-moz-focus-inner,[type=submit]::-moz-focus-inner,button::-moz-focus-inner{border-style:none;padding:0}[type=button]:-moz-focusring,[type=reset]:-moz-focusring,[type=submit]:-moz-focusring,button:-moz-focusring{outline:ButtonText dotted 1px}fieldset{padding:.35em .75em .625em}legend{color:inherit;display:table;max-width:100%;white-space:normal}textarea{overflow:auto}[type=number]::-webkit-inner-spin-button,[type=number]::-webkit-outer-spin-button{height:auto}[type=search]{-webkit-appearance:textfield;outline-offset:-2px}[type=search]::-webkit-search-decoration{-webkit-appearance:none}::-webkit-file-upload-button{-webkit-appearance:button;font:inherit}summary{display:list-item}[hidden],template{display:none}`;
            const iframeStyle = iframeDoc.createElement('style');
            iframeStyle.appendChild(iframeDoc.createTextNode(normalizeCss));
            iframeDoc.head.appendChild(iframeStyle);
        }
    }
}

// This callback is executed when cosnent management config processing is completed.
window.PWT.requestConvertServer = function (obj, callback) {
    var owNamespace = getGlobal();
    if (!obj.publisherId) {
        logWarn(LOG_WARN_PREFIX + 'Error: publisherId is mandatory and cannot be numeric (wrap it in quotes in your config)');
        return;
    }

    window.PWT.publisherId = obj.publisherId;
    timeMetrics.recordEntryTime("CMP_CALLING_TIME");

    ConsentResolver.getConsentManagementConfig(function (cmConfig) {
        if (cmConfig && !isEmpty(cmConfig)) {
            owNamespace.setConfig({
                consentManagement: cmConfig
            })
        }

        var keyWords = obj.keywords;
        var defaultExtPrebid = {
            bidderparams: {
                pubmatic: {
                    publisherId: obj.publisherId,
                    wrapper: {
                        profileid: obj.profileid || null,
                        versionid: obj.versionid || null,
                        keywords: keyWords || null
                    }
                }
            }
        }
        var extPrebid = obj.extPrebid || defaultExtPrebid;

        let s2sConfig = {
            accountId: obj.accountId || '',
            enabled: true,
            allowUnknownBidderCodes: true,
            bidders: obj.bidders || ['pubmatic'],
            timeout: obj.timeout || 1000,
            adapter: obj.adapter || 'prebidServer',
            endpoint: obj.endpoint || 'https://prebid-server.pubmatic.com/prebidserver/auction',
            extPrebid: extPrebid
        };

        if (obj.syncEndpoint && typeof obj.syncEndpoint === 'object') {
            s2sConfig["syncEndpoint"] = {
                p1Consent: obj.syncEndpoint.p1Consent || '',
                noP1Consent: obj.syncEndpoint.noP1Consent || ''
            };
        }
        owNamespace.setConfig({
            s2sConfig: s2sConfig
        });
        owNamespace.addAdUnits(obj.adUnits);
        callback();
    });
}



// Dynamic Consent Management Handler logic - START

/**
 * Consent Configuration Resolver Module
 * Refactored into multiple components for better maintainability and scalability
 */

// Dependencies


// ===========================================
// Constants Module
// ===========================================
var ConsentConstants = {
    DEFAULT_CMP_LOOK_UP_TIMEOUT: 1000,
    CONTINUOUS_CMP_CHECK_TIMEOUT: 15000,
    CONSENT_MANAGEMENT_SOURCE: {    // 1 -> CMP, 2 -> GEO, 0 -> NONE
        CMP: 1,
        GEO: 2,
        NONE: 0
    },
    COMPLIANCE_MAP: {
        GDPR: 1,
        USP: 2,
        GPP: 3
    },
    READ_GEO_DATA_FROM: {          // 1 -> LOCALSTORAGE, 2 -> GEO_SERVICE, 0 -> NONE
        LOCALSTORAGE: 1,
        GEO_SERVICE: 2,
        NONE: 0
    }
};

// ===========================================
// Configuration Manager Module
// ===========================================
var ConsentConfigManager = (function () {
    var instance;

    function createInstance() {
        function getConfig() {
            return {
                consentManagementEnabled: false,  // This will be used to enable/disable the consent management                       
                processCompleted: false,          // This Flag will use to identify if finding compliance to apply process is completed.
                cmpPresent: false,                // CMP present on the page or not false - Not Present, true - Present 
                complianceSupport: [],            // CMP's compliance supported,  1: GDPR, 2: USP, 3: GPP
                cmpId: 0,                         // CMP ID: Consent Management Platform Id, default - 0
                enforcedConsentBasisOn: ConsentConstants.CONSENT_MANAGEMENT_SOURCE.NONE,   // This will be used to enforce the consent basis on Possible values: 1 (CMP), 2 (GEO), 0 (NONE)
                readGeoDataFrom: ConsentConstants.READ_GEO_DATA_FROM.NONE,                 // This will be used to identify the source of geo data read from Possible values: 1 (LOCALSTORAGE), 2 (GEO_SERVICE), 0 (NONE)
                geoInfo: {                        // This will be used to store the geo information
                    cc: undefined,                  // Country Code Already being passed in the request     
                    sc: undefined,                  // State Code
                    gc: undefined,                  // Regulation to apply,  1: GDPR, 2: USP, 3: GPP
                    gsId: undefined                 // GPP section ID
                },
                geoMatchWithCMP: 2,               // This will be used to identify the geo match with CMP Possible values: 0 - Not Matched,1 - Matched, 2 - Not Concluded(default)
                prebidCMConfig: {},               // This will be used to apply the consentManagement config to the Prebid instance
                callbackFunctions: [],            // Functions to be called after the process is completed
                continuousCmpCheck: {
                    enabled: false,         // Continuous CMP checking enabled
                    timeout: ConsentConstants.CONTINUOUS_CMP_CHECK_TIMEOUT,         // Continuous CMP checking timeout         
                    startTime: 0            // Continuous CMP checking start time
                }
            };
        }
        var config = getConfig();

        return {
            getConsentManagementEnabled: function () {
                return config.consentManagementEnabled;
            },
            getProcessCompleted: function (callbackFn) {
                if (config.processCompleted) {
                    callbackFn();
                    return;
                }
                if (isFunction(callbackFn))
                    config.callbackFunctions.push(callbackFn);
            },
            getComplianceSupport: function () {
                return config.complianceSupport;
            },
            getPrebidCMConfig: function () {
                return config.prebidCMConfig;
            },
            setConsentManagementEnabled: function (consentManagementEnabled) {
                config.consentManagementEnabled = consentManagementEnabled;
            },
            setCmpPresent: function (cmpPresent) {
                config.cmpPresent = cmpPresent;
            },
            setProcessCompleted: function (processCompleted) {
                config.processCompleted = processCompleted;
                if (processCompleted) {
                    this.executeCallbackFunctions();
                }
            },
            executeCallbackFunctions: function () {
                while (config.callbackFunctions.length > 0) {
                    var fn = config.callbackFunctions.shift();
                    if (isFunction(fn)) {
                        fn();
                    }
                }
            },
            setCmpId: function (cmpId) {
                config.cmpId = cmpId;
            },
            setEnforcedConsentBasisOn: function (enforcedConsentBasisOn) {
                config.enforcedConsentBasisOn = enforcedConsentBasisOn;
            },
            setGeoMatchWithCMP: function () {
                if (config.geoInfo.gc && config.complianceSupport.length > 0) { // Add this condition as to check if CMP is present and what compliance it support. So that we can compare
                    config.geoMatchWithCMP = config.complianceSupport.includes(config.geoInfo.gc) ? 1 : 0;
                }
            },
            setGeoInfo: function (readFrom, geoInfo) {
                config.geoInfo = geoInfo;
                config.readGeoDataFrom = readFrom;
                this.setGeoMatchWithCMP();
            },
            disablePrebidCMConfig: function () {
                for (var key in config.prebidCMConfig) {
                    if (config.prebidCMConfig.hasOwnProperty(key)) {
                        config.prebidCMConfig[key].enabled = false;
                    }
                }
            },
            setPrebidCMConfig: function (key, conf) {
                config.prebidCMConfig[key] = conf;
            },
            setComplianceSupport: function (compliance) {
                if (!config.complianceSupport.includes(compliance)) {
                    config.complianceSupport.push(compliance);
                }
            },
            getContinuousCmpCheckEnabled: function () {
                return config.continuousCmpCheck.enabled;
            },
            setContinuousCmpCheckEnabled: function (enabled) {
                config.continuousCmpCheck.enabled = enabled;
            },
            getContinuousCmpCheckTimeout: function () {
                return config.continuousCmpCheck.timeout;
            },
            getContinuousCmpCheckStartTime: function () {
                return config.continuousCmpCheck.startTime;
            },
            setContinuousCmpCheckStartTime: function (time) {
                config.continuousCmpCheck.startTime = time;
            },
            getProperties: function () {
                return {
                    ccme: config.consentManagementEnabled ? 1 : 0,
                    ccmp: config.cmpPresent ? 1 : 0,
                    ccmps: config.complianceSupport,
                    ccmpid: config.cmpId,
                    csc: config.geoInfo.sc,
                    cecbo: config.enforcedConsentBasisOn,
                    crgdf: config.readGeoDataFrom,
                    cgm: config.geoMatchWithCMP,
                    cccce: config.continuousCmpCheck.enabled,
                    cccct: config.continuousCmpCheck.timeout,
                    ccccst: config.continuousCmpCheck.startTime
                };
            },
            reset: function () {
                config = getConfig();
            }
        };
    }

    return {
        getInstance: function () {
            if (!instance) {
                instance = createInstance();
            }
            return instance;
        }
    };
})();

var crConfig = ConsentConfigManager.getInstance();

// ===========================================
// Compliance API Configuration Module
// ===========================================
var ComplianceApiConfig = (function () {
    // Private configuration
    var apiConfig = {
        GDPR: {
            apiName: "__tcfapi",
            complianceName: "gdpr",
            prepareConfig: null // Will be set after ComplianceHandler is defined
        },
        USP: {
            apiName: "__uspapi",
            complianceName: "usp",
            prepareConfig: null // Will be set after ComplianceHandler is defined
        },
        GPP: {
            apiName: "__gpp",
            complianceName: "gpp",
            prepareConfig: null // Will be set after ComplianceHandler is defined
        }
    };

    return {
        getApiConfig: function () {
            return apiConfig;
        },
        setConfigHandlers: function (gdprHandler, uspHandler, gppHandler) {
            apiConfig.GDPR.prepareConfig = gdprHandler;
            apiConfig.USP.prepareConfig = uspHandler;
            apiConfig.GPP.prepareConfig = gppHandler;
        }
    };
})();

// ===========================================
// Compliance Handler Module
// ===========================================
var ComplianceHandler = (function () {
    function configureGDPR() {
        var gdprConfig = {
            cmpApi: "iab",
            timeout: 5000,
            defaultGdprScope: true,
        };

        var gdprActionTimeout = commonUtil.getGlobalOwObject().actionTimeout || undefined;
        if (gdprActionTimeout && isNumber(gdprActionTimeout)) {
            gdprConfig.actionTimeout = gdprActionTimeout;
        }
        crConfig.setPrebidCMConfig("gdpr", gdprConfig);
    }

    function configureUSP() {
        var uspConfig = {
            cmpApi: "iab",
            timeout: 1000
        };

        crConfig.setPrebidCMConfig("usp", uspConfig);
    }

    function configureGPP() {
        var gppConfig = {
            cmpApi: "iab",
            timeout: 2000
        };

        crConfig.setPrebidCMConfig("gpp", gppConfig);
    }

    // Set the compliance handlers in the ComplianceApiConfig
    ComplianceApiConfig.setConfigHandlers(configureGDPR, configureUSP, configureGPP);
})();

// ===========================================
// Geo Service Module
// ===========================================
var GeoService = (function () {
    function getGeoInfoWrapper() {
        timeMetrics.recordEntryTime("GEO_CALLING_TIME", 1500); // Setting default timeout of 1500 ms in case service fails or didn't respond
        logInfo("ConsentResolver: Fetching geo information");
        commonUtil.getGeoInfo(ConsentConstants.READ_GEO_DATA_FROM, function (readFrom, geoInfo) {
            crConfig.setGeoInfo(readFrom, geoInfo);
            logInfo("ConsentResolver: Geo info received - Source: " + readFrom + ", Country: " + (geoInfo.cc || "unknown"));
            timeMetrics.recordExitTime("GEO_CALLING_TIME");
        });
    }

    return {
        getGeoInfoWrapper: getGeoInfoWrapper
    };
})();

// ===========================================
// CMP Detector Module
// ===========================================
var CmpDetector = (function () {

    function checkCMPInWindow(frame) {
        var cmpApis = ComplianceApiConfig.getApiConfig();
        var detectedCmps = [];

        for (var compliance in cmpApis) {
            if (cmpApis.hasOwnProperty(compliance)) {
                var apiName = cmpApis[compliance].apiName;
                if (typeof frame[apiName] === 'function') {
                    logInfo("ConsentResolver: Detected " + compliance + " CMP with API: " + apiName);
                    detectedCmps.push({
                        compliance: compliance,
                        api: frame[apiName],
                        prepareConfig: cmpApis[compliance].prepareConfig
                    });
                }
            }
        }
        return detectedCmps;
    }

    function getCMPsPresentOnPage() {
        var detectedCmps = [];
        var currentWindow = window;

        // Iterate through window frames to find CMPs
        while (currentWindow) {
            detectedCmps = detectedCmps.concat(checkCMPInWindow(currentWindow));
            if (currentWindow === window.top) break;
            currentWindow = currentWindow.parent;
        }
        return detectedCmps;
    }

    return {
        getCMPsPresentOnPage: getCMPsPresentOnPage
    };
})();

// ===========================================
// Consent Resolver Module (Main Orchestrator)
// ===========================================
var ConsentResolver = (function () {
    function setCMPTime(timeExceeded) {
        // If time taken by CMP is not set then set the default timeout value
        if (!timeMetrics.getDurationOf("CMP_CALLING_TIME")) {
            timeMetrics.recordExitTime("CMP_CALLING_TIME", timeExceeded ? 1500 : null);
        }
    }

    function getCMPLookUpTimeout() {
        return (commonUtil.getGlobalOwObject() && isNumber(commonUtil.getGlobalOwObject().cmpLookUpTimeout))
            ? commonUtil.getGlobalOwObject().cmpLookUpTimeout
            : ConsentConstants.DEFAULT_CMP_LOOK_UP_TIMEOUT;
    }

    function handleGDPR(pingReturnData, success) {
        if (success && pingReturnData && pingReturnData.cmpId) {
            crConfig.setCmpId(pingReturnData.cmpId);
        }
    }

    function handleGPP(pingReturnData, success) {
        crConfig.setCmpId(pingReturnData && pingReturnData.pingData && pingReturnData.pingData.cmpId);
    }

    function setConsentResolverConfig(detectedCmps) {
        // If GDPR CMP is detected, get CMP ID
        logInfo("ConsentResolver: Setting consent config for " + detectedCmps.length + " detected CMPs");
        for (var j = 0; j < detectedCmps.length; j++) {
            setCMPTime(false);
            crConfig.setComplianceSupport(ConsentConstants.COMPLIANCE_MAP[detectedCmps[j].compliance]);
            crConfig.setCmpPresent(true);
            if (detectedCmps[j].compliance === "GDPR") {
                detectedCmps[j].api("addEventListener", 2, handleGDPR);
            } else if (detectedCmps[j].compliance === "GPP") {
                detectedCmps[j].api("addEventListener", handleGPP);
            }
        }
    }

    function getConsentManagementConfig(callbackToSetConfig) {
        var isCallbackExecuted = false;
        var timeoutId;

        function executeCallback(enforcedConsentBasisOn) {
            if (!isCallbackExecuted) {
                clearTimeout(timeoutId);
                isCallbackExecuted = true;
                timeMetrics.recordExitTime("CONSENT_CONFIG_RESOLVER_TIME");
                logInfo("ConsentResolver: Executing callback with consent basis: " +
                    (enforcedConsentBasisOn === ConsentConstants.CONSENT_MANAGEMENT_SOURCE.CMP ? "CMP" :
                        (enforcedConsentBasisOn === ConsentConstants.CONSENT_MANAGEMENT_SOURCE.GEO ? "GEO" : "NONE")));
                logInfo("ConsentResolver: Setting consent management config: " + JSON.stringify(crConfig.getPrebidCMConfig()));
                callbackToSetConfig(crConfig.getPrebidCMConfig());
                crConfig.setEnforcedConsentBasisOn(enforcedConsentBasisOn);
                crConfig.setProcessCompleted(true);
            }
        }

        function proceedToFallbackExecution() {
            setCMPTime(true); // Record CMP timing metrics
            logInfo("ConsentResolver: CMP detection timed out, falling back to geo-based consent");

            var globalObj = commonUtil.getGlobalOwObject();
            if (!globalObj || !globalObj.CC || !globalObj.CC.gc) {
                logInfo("ConsentResolver: No geo compliance info available, disabling consent management");
                executeCallback(ConsentConstants.CONSENT_MANAGEMENT_SOURCE.NONE);
                return;
            }

            // Get compliance type based on geo location
            var compliance = commonUtil.getKeyByValue(ConsentConstants.COMPLIANCE_MAP, globalObj.CC.gc);
            if (compliance) {
                logInfo("ConsentResolver: Using geo-based compliance: " + compliance);
                ComplianceApiConfig.getApiConfig()[compliance].prepareConfig(); // Configure consent based on geo location
                //ConsentSetterForContinuousCMPCheck.proceedToContinuousCmpCheck();
                executeCallback(ConsentConstants.CONSENT_MANAGEMENT_SOURCE.GEO);
            } else {
                logInfo("ConsentResolver: No compliance type found from geo data: " + globalObj.CC.gc);
                executeCallback(ConsentConstants.CONSENT_MANAGEMENT_SOURCE.NONE);
            }
        }

        function checkCmpRecursively() {
            if (isCallbackExecuted) {
                return;
            }
            var detectedCmps = CmpDetector.getCMPsPresentOnPage();
            if (detectedCmps.length === 0) {
                setTimeout(checkCmpRecursively, 50);
            } else {
                logInfo("ConsentResolver: CMP detected, count: " + detectedCmps.length);
                setConsentResolverConfig(detectedCmps);
                for (var i = 0; i < detectedCmps.length; i++) {
                    detectedCmps[i].prepareConfig();
                }
                crConfig.setGeoMatchWithCMP();
                executeCallback(ConsentConstants.CONSENT_MANAGEMENT_SOURCE.CMP);
            }
        }

        // Main execution flow
        timeMetrics.recordEntryTime("CONSENT_CONFIG_RESOLVER_TIME");
        logInfo("ConsentResolver: Starting consent configuration resolution");

        // As this will be always enabled, we are skipping this check
        // if (!COMMON_CONFIG.consentManagementEnabled()) {
        //   logInfo("ConsentResolver: Consent management disabled in config");
        //   executeCallback(ConsentConstants.CONSENT_MANAGEMENT_SOURCE.NONE);
        //   return;
        // }

        crConfig.setConsentManagementEnabled(true);
        GeoService.getGeoInfoWrapper();
        var timeout = getCMPLookUpTimeout();
        logInfo("ConsentResolver: Looking for CMP with timeout: " + timeout + "ms");
        timeoutId = setTimeout(proceedToFallbackExecution, timeout); // Timeout for checking CMP presence
        checkCmpRecursively();
    }

    return {
        getConsentManagementConfig: getConsentManagementConfig,
        setConsentResolverConfig: setConsentResolverConfig
    };
})();


// HELPER FUNCTIONS

var commonUtil = (function () {
    /**
     * Retrieves geographic information, either from local storage or by detecting it via a geo service.
     *
     * @param {Object} readFrom - An object containing possible sources of geo information (e.g., LOCALSTORAGE, GEO_SERVICE).
     * @param {Function} callback - A callback function to execute once the geo information is retrieved.
     */
    function getGeoInfo(readFrom, callback) {
        var PREFIX = 'UINFO'; // Prefix used for storing and retrieving geo information in local storage
        var LOCATION_INFO_VALIDITY = 172800000; // Validity period for stored geo information (2 days in milliseconds)

        // Construct the URL for the geo-detection service with the publisher ID from the configuration
        var geoDetectionURL = 'https://ut.pubmatic.com/geo?pubid=' + window.PWT.publisherId;

        // Attempt to retrieve geo information from local storage
        var info = getGlobal().getDataFromLocalStorage(PREFIX, LOCATION_INFO_VALIDITY);

        // Check if valid geo information is found in local storage
        if (info && JSON.parse(info).cc) { // If valid data is present
            // Set the global object with the country code from local storage
            getGlobalOwObject().CC = JSON.parse(info);
            // If a callback is provided, execute it with the source being local storage
            if (callback) callback(readFrom.LOCALSTORAGE, getGlobalOwObject().CC);
        } else {
            // If no valid data is found, use the geo-detection service to get the location
            getGlobal().detectLocation(geoDetectionURL, function (loc, success) {
                // Check if the location was successfully detected
                if (loc && success) {
                    // If a callback is provided, execute it with the source being the geo service
                    if (callback) callback(readFrom.GEO_SERVICE, loc);

                    // Store the detected location in local storage for future use
                    getGlobal().setAndStringifyToLocalStorage(PREFIX, loc);

                    // Set the global object with the newly detected location
                    getGlobalOwObject().CC = loc;
                }
            });
        }
    }

    /**
     * Retrieves the global OpenWrap object, creating it if it doesn't exist. Example: PWT
     *
     * @returns {Object} - The global OpenWrap object from the window namespace.
     */
    function getGlobalOwObject() {
        window.PWT = window.PWT || {};
        return window.PWT;
    }

    /**
     * Get a key value from an object based on the value.
     * @param {*} obj 
     * @param {*} value 
     * @returns key name or else null
     */
    function getKeyByValue(obj, value) {
        for (var key in obj) {
            if (obj.hasOwnProperty(key)) {
                if (obj[key] === value) {
                    return key;
                }
            }
        }
        return null; // Return null if value not found
    }

    return {
        getGeoInfo: getGeoInfo,
        getGlobalOwObject: getGlobalOwObject,
        getKeyByValue: getKeyByValue
    };
})();

var timeMetrics = (function () {
    var metrics = {};

    // Get a metrics object within PWT
    function getMetricsObject() {
        return metrics;
    }

    commonUtil.getGlobalOwObject().getMetrics = getMetricsObject;

    // Function to set entry and exit times for a specific module and/or function
    function setMetrics(options) {
        if (options.keyName) {
            if (!getMetricsObject()[options.keyName]) {
                getMetricsObject()[options.keyName] = {
                    st: options.entryTime || null,
                    et: options.exitTime || null,
                    tt: options.duration || null
                };
            }
        }
    }

    // Function to get metrics for a specific module and/or function
    function getMetrics(keyName) {
        if (keyName) {
            return getMetricsObject()[keyName] || null;
        }
        return null;
    }


    /**
     * Retrieves the duration of a specific keyName
     */
    function getDurationOf(keyName) {
        var metrics = getMetrics(keyName);
        if (metrics) {
            return metrics.tt;
        }
        return null;
    };


    // Function to record the entry time for one or multiple keys with defaultTotaltime
    function recordEntryTime(keyNames, defaultTotalTime) {
        var currentTime = new Date().getTime();
        defaultTotalTime = defaultTotalTime || 0;

        keyNames = Array.isArray(keyNames) ? keyNames : [keyNames];

        keyNames.forEach(function (keyName) {
            // Record the metrics for each keyName, including the entry time and duration
            setMetrics({ keyName: keyName, entryTime: currentTime, duration: defaultTotalTime });
        });
    }

    // Function to record the exit time and total time for one or multiple keys
    function recordExitTime(keyNames, defaultTotalTime) {
        var currentTime = new Date().getTime();
        defaultTotalTime = defaultTotalTime || 0;

        keyNames = Array.isArray(keyNames) ? keyNames : [keyNames];

        keyNames.forEach(function (keyName) {
            var metrics = getMetrics(keyName);
            if (metrics) {
                // Update total time based on whether a default total time is provided
                metrics.tt = defaultTotalTime || (metrics.et = currentTime, currentTime - metrics.st);
            }
        });
    }

    return {
        getMetricsObject: getMetricsObject,
        getDurationOf: getDurationOf,
        recordEntryTime: recordEntryTime,
        recordExitTime: recordExitTime
    }
})();

commonUtil.getGlobalOwObject().getConsentResolverConfig = function getConsentResolverConfig() {
    return crConfig.getProperties();
};
