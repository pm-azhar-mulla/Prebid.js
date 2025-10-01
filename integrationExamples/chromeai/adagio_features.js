/**
 * ADAGIO Features Manager
 * Detects and manages browser features and device capabilities
 */

// Use the global ADAGIO namespace
var utils = window.ADAGIO.utils;

/**
 * Features Manager - Manages browser and device features
 * @class FeaturesManager
 */
window.ADAGIO.classes.FeaturesManager = utils.createClass(function FeaturesManager() {
    utils.assertInstance(this, window.ADAGIO.classes.FeaturesManager);
    this._featuresByAdUnitElementId = {};
    this.init();
}, [
    {
        key: "init",
        value: function init() {
            // Initialize features manager
        }
    },
    {
        key: "storeLegacy",
        value: function storeLegacy(elementId, features, overwrite) {
            if (utils.getType(features) !== "object" || (this.get(elementId) && !overwrite)) {
                return false;
            }
            
            this._featuresByAdUnitElementId[elementId] = features;
        }
    },
    {
        key: "store",
        value: function store(data, overwrite) {
            var adUnitCode = data.adUnitCode;
            var features = data.features;
            var params = data.params;
            
            if (params.adUnitElementId) {
                if (utils.getType(features) !== "object" || (this.get(params.adUnitElementId) && !overwrite)) {
                    utils.logWarning("Features cannot be set. data.features is not an object. adUnitCode: " + adUnitCode);
                    return false;
                }
                
                var pageUrl = "";
                if (utils.isTopAccessible()) {
                    pageUrl = utils.getTopWindow().location.href || "";
                }
                
                // Add standard features
                var enhancedFeatures = utils.mergeObjects({}, features, {
                    device: utils.detectDeviceType().toString(),
                    os: utils.detectOS(),
                    browser: utils.detectBrowser(),
                    url: pageUrl
                });
                
                this._featuresByAdUnitElementId[params.adUnitElementId] = {
                    version: "_",
                    features: enhancedFeatures
                };
            } else {
                utils.logWarning("Features cannot be set. Missing adUnitElementId. adUnitCode: " + adUnitCode);
            }
        }
    },
    {
        key: "get",
        value: function get(elementId) {
            return elementId 
                ? this._featuresByAdUnitElementId[elementId] 
                : this._featuresByAdUnitElementId;
        }
    }
]);

/**
 * Detect operating system
 * @returns {string} Operating system name
 */
function detectOS() {
    var userAgent = getTopWindow().navigator.userAgent.toLowerCase();
    
    if (userAgent.indexOf("android") > 0) {
        return "android";
    } else if (userAgent.indexOf("iphone") > 0) {
        return "ios";
    } else if (userAgent.indexOf("linux") > 0) {
        return "linux";
    } else if (userAgent.indexOf("mac") > 0) {
        return "mac";
    } else if (userAgent.indexOf("win") > 0) {
        return "windows";
    } else {
        return "";
    }
}

/**
 * Check if top window is accessible
 * @returns {boolean} Whether top window is accessible
 */
function isTopAccessible() {
    try {
        if (window.top.location.href) {
            return true;
        }
    } catch (e) {
        return false;
    }
}

/**
 * Bidder sync mappings for user syncing
 * @type {Array<Array<string>>}
 */
var BIDDER_SYNC_MAPPINGS = [
    ["rubicon", "secure-assets.rubiconproject.com"],
    ["pubmatic", "ads.pubmatic.com"],
    ["improvedigital", "ice.360yield.com"],
    ["onetag", "onetag-sys.com"],
    ["indexexchange", "ssum-sec.casalemedia.com"],
    ["richaudience", "sync.richaudience.com"],
    ["33across", "ssc-cms.33across.com"],
    ["appnexus", "ib.adnxs.com"],
    ["smart", "ssbsync.smartadserver.com"],
    ["adyoulike", "visitor.omnitagjs.com"],
    ["sovrn", "ap.lijit.com"],
    ["freewheel", "ads.stickyadstv.com"],
    ["openx", "u.openx.net"],
    ["openxpbs", "u.openx.net"],
    ["triplelift", "eb2.3lift.com"],
    ["eplanning", "ads.us.e-planning.net"],
    ["unruly", "sync.1rx.io"]
];

/**
 * Custom bidder sync list
 * @type {Array}
 */
var CUSTOM_SYNC_BIDDERS = [];
