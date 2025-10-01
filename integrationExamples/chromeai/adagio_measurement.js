/**
 * ADAGIO Measurement Core
 * Provides viewability measurement functionality
 */

// Use the global ADAGIO namespace
var utils = window.ADAGIO.utils;
var constants = window.ADAGIO.constants;

// ========================================================================
// VIEW MEASUREMENT CONSTANTS
// ========================================================================

/**
 * Field name mappings for beacon data
 * @type {Object}
 */
var FEATURE_FIELD_MAPPINGS = {
    page_dimensions: "pg_dims",
    viewport_dimensions: "vp_dims",
    dom_loading: "dom_l",
    layout: "lay",
    adunit_position: "adu_pos",
    user_timestamp: "u_ts",
    device: "dvc",
    browser: "brwsr",
    url: "url",
    print_number: "pn"
};

/**
 * Parameter name mappings for beacon data
 * @type {Object}
 */
var PARAM_FIELD_MAPPINGS = {
    organizationId: "org_id",
    site: "site",
    placement: "plcmt",
    adUnitCode: "adu_code",
    pagetype: "pgtyp",
    category: "cat",
    subcategory: "subcat",
    environment: "env"
};

/**
 * Ad server parameter mappings for beacon data
 * @type {Object}
 */
var ADSERVER_FIELD_MAPPINGS = {
    adsrv: "adsrv",
    adsrv_advrt_id: "adsrv_advrt_id",
    adsrv_cmpgn_id: "adsrv_cmpgn_id",
    adsrv_crea_id: "adsrv_crea_id",
    adsrv_empty: "adsrv_empty",
    adsrv_lnitem_id: "adsrv_lnitem_id",
    adsrv_size: "adsrv_size"
};

/**
 * Organization IDs with special sampling
 * @type {Array<string>}
 */
var SPECIAL_SAMPLING_ORG_IDS = ["1012"];

/**
 * Find best fitting element for measurement
 * @param {HTMLElement} element - Element to check
 * @param {Array<string>} sizes - Sizes to match
 * @returns {HTMLElement|boolean} Matching element or false
 */
window.ADAGIO.utils.findBestElement = function(element, sizes) {
    if (!sizes || !sizes.length) return false;
    if (!element || typeof element.getBoundingClientRect !== "function") return false;
    
    try {
        var rect = element.getBoundingClientRect();
        var size = Math.round(rect.width) + "x" + Math.round(rect.height);
        
        if (sizes.indexOf(size) !== -1) {
            return element;
        }
        
        var children = element.querySelectorAll("*:not(script)");
        if (children.length) {
            for (var i = 0, len = children.length; i < len; i++) {
                var result = findBestElement(children[i], sizes);
                if (result) return result;
            }
            return false;
        }
    } catch (e) {
        // Ignore errors
    }
    
    return false;
}

/**
 * GPT impressionViewable event handler
 * @param {CustomEvent} event - The event object
 */
window.ADAGIO.utils.handleGptImpressionViewable = function(event) {
    var timestamp = new Date(event.detail.ts).toString();
    var elementId = "";
    
    if (event.detail.data.event && event.detail.data.event.slot) {
        elementId = event.detail.data.event.slot.getSlotElementId();
    } else if (event.detail.data.args && event.detail.data.args.slot) {
        elementId = event.detail.data.args.slot.getSlotElementId();
    }
    
    if (elementId === this._adUnitElementId) {
        logDebug("GPT impressionViewable: " + elementId + " at " + timestamp);
        
        this.viewability.adserver.visible = true;
        this.viewability.adserver.viewableSince = event.detail.ts;
        this.viewability.adserver.exposureDelta = 
            this.viewability.adagio.exposureDuration - 1000;
            
        this.sendBeacon({
            becauseOf: "vsbl_actvw"
        });
    }
}

/**
 * GPT slotVisibilityChanged event handler
 * @param {CustomEvent} event - The event object
 */
window.ADAGIO.utils.handleGptSlotVisibilityChanged = function(event) {
    var args = event.detail.data.args;
    var visibilityPercentage = args.inViewPercentage;
    var slot = args.slot;
    
    if (!slot) return;
    
    if (slot.getSlotElementId() === this._adUnitElementId) {
        this.viewability.adserver.inViewport = visibilityPercentage >= 50;
    }
}

/**
 * Handle visibility change (document hidden) for beacons
 */
window.ADAGIO.utils.handleVisibilityChangeForBeacon = function() {
    if (this.w.document.visibilityState === "hidden") {
        if (!this.hasMaxExposureDuration()) {
            this.sendBeacon({
                becauseOf: "visibilitychange"
            });
        }
    }
}

/**
 * Handle visibility change for computing exposure time
 */
window.ADAGIO.utils.handleVisibilityChangeForExposure = function() {
    var now = Date.now();
    
    if (this.w.document.visibilityState === "hidden") {
        this.pageVisibility.ts = now;
    } else {
        this.pageVisibility.computedDuration += now - this.pageVisibility.ts;
        this.pageVisibility.ts = false;
    }
}

/**
 * Ad Viewability Measurer - Core measurement functionality
 * @class ViewabilityMeasurer
 */
window.ADAGIO.classes.ViewabilityMeasurer = utils.createClass(function ViewabilityMeasurer(config) {
    var ts = config.ts;
    var adUnitElementId = config.adUnitElementId;
    var auctionId = config.auctionId;
    var params = config.params;
    var options = config.options;
    var featuresManager = config.featuresManager;
    var measurersManager = config.measurersManager;
    var navigationFeatures = config.navigationFeatures;
    
    utils.assertInstance(this, window.ADAGIO.classes.ViewabilityMeasurer);
    
    this.w = utils.getTopWindow();
    this.navigationFeatures = navigationFeatures;
    this.featuresManager = featuresManager;
    this.measurersManager = measurersManager;
    this.params = params || {};
    this.options = options || {};
    this.auctionId = auctionId;
    
    // Timing and state properties
    this.initTime = null;
    this.startTime = null;
    this.ts = ts;
    this.navigationStart = getNavigationStartTime();
    this.internalId = generateUUID() + generateUUID();
    this.resetCounter = 0;
    this.resetTime = null;
    this.beaconVersion = 0;
    
    // Control properties
    this.intervalId = false;
    this.avwBeaconTimeoutId = false;
    this.refreshStarted = false;
    this.refreshConfig = this.options.refresh || false;
    this.doNotRefresh = false;
    this.useIntersectionObserver = true;
    
    // Event handlers
    this.clickListenerHandler = null;
    this.mouseHoverListenerHandler = null;
    this.mouseOutListenerHandler = null;
    this.gptImpressionViewable = window.ADAGIO.utils.handleGptImpressionViewable.bind(this);
    this.gptSlotVisibilityChanged = window.ADAGIO.utils.handleGptSlotVisibilityChanged.bind(this);
    
    // Visibility tracking
    this.pageVisibility = {
        ts: false,
        computedDuration: 0
    };
    
    // Element properties
    this._adUnitElementId = this.adUnitElementId = adUnitElementId;
    this.element = {};
    this.prebidAdUnitConfig = this.options.adUnitConfig || [];
    
    // Beacon settings
    this.throttleBeacons = typeof this.options.throttleBeacons !== "boolean" || 
        this.options.throttleBeacons;
    this.beaconsQueue = [];
    this.beaconsPending = false;
    this.limitFirstBeaconsTimer = false;
    
    // Initialize if element exists
    if (window.self.document.getElementById(this.adUnitElementId)) {
        if (this.init()) {
            this.unbindBeaconEvents();
            this.bindBeaconEvents();
            this.start();
        } else {
            logWarning("Unable to init measurer");
            return false;
        }
    } else {
        logWarning("Element to measure is missing in window: " + this.adUnitElementId);
        return false;
    }
}, [
    {
        key: "init",
        value: function init() {
            this.initTime = Date.now();
            this.measurable = true;
            
            // Get features for this ad unit
            var featureData = this.getFeatures(this._adUnitElementId);
            this.features = featureData && featureData.features ? featureData.features : {};
            this.featuresVersion = featureData && featureData.version ? featureData.version : "1";
            
            // Bind event handlers
            this.clickListenerHandler = this.clickListener.bind(this);
            this.mouseHoverListenerHandler = this.mouseHoverListener.bind(this);
            this.mouseOutListenerHandler = this.mouseOutListener.bind(this);
            
            // Set initial viewability state
            this.resetViewability();
            
            // Check for IntersectionObserver API support
            if (!window.IntersectionObserver) {
                this.useIntersectionObserver = false;
                this.measurable = false;
                logWarning("no intersection observer");
                this.stop("noIObserver");
                return;
            }
            
            // Check for CustomEvent API support
            if (typeof window.CustomEvent !== "function") {
                this.stop("noCustomEvent");
                return false;
            }
            
            // Bind ad server events
            this.bindAdserverEvents();
            
            // Find the best element to measure
            var bestElement = this.detectBestDomElement();
            if (!bestElement) {
                this.stop("noElement");
                return false;
            }
            
            // Set element and start background detection
            this.setElement(bestElement);
            this.startBackgroundDetection();
            
            // Initialize refresh configuration
            this.w.ADAGIO = this.w.ADAGIO || {};
            this.w.ADAGIO.doNotRefresh = getDoNotRefreshList() || this.w.ADAGIO.doNotRefresh || [];
            
            var adUnitCode = this.params.adUnitCode || false;
            
            // Check if refresh is disabled
            if (!this.refreshConfig) {
                this.doNotRefresh = true;
            }
            
            if (!adUnitCode) {
                logDebug("No adUnitCode for this Measurer: " + adUnitCode);
                this.doNotRefresh = true;
            }
            
            if (Array.isArray(this.w.ADAGIO.doNotRefresh) && 
                this.w.ADAGIO.doNotRefresh.indexOf("*") !== -1) {
                logDebug("No Refresh because doNotRefresh is activate on the whole page");
                this.doNotRefresh = true;
            }
            
            if (Array.isArray(this.w.ADAGIO.doNotRefresh) && 
                adUnitCode && 
                this.w.ADAGIO.doNotRefresh.indexOf(adUnitCode) !== -1) {
                logDebug("This adUnitCode is in the ADAGIO.doNotRefresh: " + adUnitCode);
                this.doNotRefresh = true;
            }
            
            return true;
        }
    },
    {
        key: "resetViewability",
        value: function resetViewability(provider) {
            var defaultViewability = {
                adagio: {
                    visible: false,
                    continuousCounter: 0,
                    viewableSince: null,
                    exposureDuration: 0,
                    lastUpdateTs: false,
                    elementMouseOver: false,
                    exposureDurationOnClick: null,
                    lastAttentionBeaconSent: 0,
                    inViewport: false
                },
                adserver: {
                    visible: false,
                    viewableSince: null,
                    continuousCounter: 0,
                    exposureDuration: 0,
                    lastUpdateTs: false,
                    lastAttentionBeaconSent: 0,
                    exposureDelta: 0,
                    inViewport: false
                }
            };
            
            if (provider && this.viewability && 
                Object.prototype.hasOwnProperty.call(this.viewability, provider)) {
                this.viewability[provider] = Object.assign({}, defaultViewability[provider]);
            } else {
                this.viewability = Object.assign({}, defaultViewability);
            }
            
            this.startObserver(true);
        }
    },
    {
        key: "detectBestDomElement",
        value: function detectBestDomElement() {
            try {
                var element = window.self.document.getElementById(this.adUnitElementId);
                var elementWithIABDims = utils.findBestElement(element, constants.STANDARD_AD_SIZES);
                var hasIABDimensions = !!elementWithIABDims;
                
                // Check for Prebid.js specified sizes
                var prebidSizes = [];
                if (this.prebidAdUnitConfig.sizes && this.prebidAdUnitConfig.sizes.length) {
                    prebidSizes = this.prebidAdUnitConfig.sizes.map(function(size) {
                        return size[0] + "x" + size[1];
                    });
                }
                
                var elementWithPbjsDims = utils.findBestElement(element, prebidSizes);
                var hasPbjsDimensions = !!elementWithPbjsDims;
                
                // Use the best available element
                var bestElement = elementWithPbjsDims || elementWithIABDims || element;
                
                return {
                    el: bestElement,
                    elId: bestElement.id,
                    size: this.formatElementSize(bestElement),
                    reasonNotMeasurable: elementWithIABDims 
                        ? REASON_NOT_MEASURABLE_NO_IAB_DIMS 
                        : REASON_NOT_MEASURABLE_HAS_IAB_DIMS,
                    hasIABDimensions: hasIABDimensions,
                    hasPbjsDimensions: hasPbjsDimensions
                };
            } catch (e) {
                logError(e);
                return false;
            }
        }
    },
    {
        key: "setElement",
        value: function setElement(element) {
            this.element = element;
        }
    },
    {
        key: "hasMinPageExposureDuration",
        value: function hasMinPageExposureDuration() {
            // Check if page has been loaded for at least 30 seconds
            return !!(getDomContentLoadedTime() && 
                     Date.now() - getDomContentLoadedTime() >= 30000);
        }
    },
    {
        key: "hasMaxExposureDuration",
        value: function hasMaxExposureDuration() {
            if (this.options.adsrv === "dfp") {
                return this.viewability.adagio.exposureDuration > 90000 || 
                       this.viewability.adserver.exposureDuration > 90000 || 
                       (this.viewability.adagio.exposureDuration > 60000 && 
                        this.viewability.adserver.exposureDuration > 60000);
            } else {
                return this.viewability.adagio.exposureDuration > 60000;
            }
        }
    },
    {
        key: "formatElementSize",
        value: function formatElementSize(element) {
            try {
                var rect = element.getBoundingClientRect();
                return [Math.round(rect.width), Math.round(rect.height)].join("x");
            } catch (e) {
                return "0x0";
            }
        }
    },
    // Add more methods for ViewabilityMeasurer...
    {
        key: "start",
        value: function start() {
            this.startTime = Date.now();
            
            if (typeof window.CustomEvent !== "function") {
                this.stop("abort");
                return false;
            }
            
            this.sendBeacon({
                becauseOf: "start"
            });
            
            this.bindMouseListeners(this.element.el);
            this.bindClickListener();
            this.bindMeasureEvents();
            
            // Dispatch event that measurement has started
            this.w.document.dispatchEvent(new CustomEvent("adagio.measure.afterStart", {
                detail: {
                    measure: this
                }
            }));
        }
    },
    {
        key: "stop",
        value: function stop(reason) {
            reason = reason || "stop";
            
            this.unbindAdserverEvents();
            this.unbindMeasureEvents();
            this.unbindClickListener();
            
            if (this.element.el) {
                this.unbindMouseListeners(this.element.el);
            }
            
            this.unbindBeaconEvents();
            this.resetThrottledBeacon();
            
            this.sendBeacon({
                becauseOf: reason
            });
            
            // Disable sending beacons after stop
            this.sendBeacon = function() {};
        }
    },
    {
        key: "resetWithElement",
        value: function resetWithElement(element) {
            this.resetCounter++;
            this.resetTime = Date.now();
            
            if (this.element.el) {
                this.unbindMouseListeners(this.element.el);
            }
            
            this.setElement(element);
            this.bindMouseListeners(this.element.el);
            this.resetViewability();
            
            this.sendBeacon({
                becauseOf: "reset"
            });
        }
    },
    {
        key: "sendBeacon",
        value: function sendBeacon(options) {
            var self = this;
            var events = (options = options || {}).events || [];
            
            // Check if we can send beacons
            if (!this.navigationFeatures) {
                return false;
            }
            
            if (!this.navigationFeatures.allowBeaconSending("avw")) {
                return false;
            }
            
            // Handle throttled beacons
            if (this.throttleBeacons && 
                ["start", "reset", "vsbl", "vsbl_actvw"].indexOf(options.becauseOf) !== -1 && 
                !options.throttled) {
                
                if (this.beaconsPending) {
                    this.beaconsQueue.push(options);
                    return;
                }
                
                this.beaconsPending = true;
                this.beaconsQueue.push(options);
                
                setTimeout(this.sendThrottledBeacon.bind(this), 3000);
                return;
            }
            
            // Send the beacon with all data
            sendBeaconToEndpoint({
                collector: "avw",
                data: function() {
                    options = options || {};
                    var now = Date.now();
                    var domContentLoadedTime = getDomContentLoadedTime();
                    var timezoneOffset = 0;
                    
                    try {
                        timezoneOffset = (new Date()).getTimezoneOffset();
                    } catch (e) {
                        // Ignore error
                    }
                    
                    // Get prebid sizes
                    var prebidSizes = [];
                    if (self.prebidAdUnitConfig && Array.isArray(self.prebidAdUnitConfig.sizes)) {
                        self.prebidAdUnitConfig.sizes.map(function(size) {
                            return prebidSizes.push(size.join("x"));
                        });
                    }
                    
                    // Build beacon data
                    var beaconData = {
                        pv_id: self.w.ADAGIO && self.w.ADAGIO.pageviewId ? self.w.ADAGIO.pageviewId : "",
                        adu_el_id: self.adUnitElementId,
                        v: self.beaconVersion++,
                        tz_off: timezoneOffset,
                        evt: options.becauseOf || "",
                        js_late: self.w.ADAGIO && self.w.ADAGIO.late === true ? 1 : 0,
                        js_ts: self.w._ADAGIO && self.w._ADAGIO.adagioStartTime ? self.w._ADAGIO.adagioStartTime : "",
                        size: self.element.size,
                        pbjs_sizes: prebidSizes.join(","),
                        is_pbjs_size: self.element.hasPbjsDimensions === true ? 1 : 0,
                        is_iab_size: self.element.hasIABDimensions === true ? 1 : 0,
                        msrbl: self.measurable === true ? 1 : 0,
                        adu_exp: self.viewability.adagio.exposureDuration,
                        pg_durat: domContentLoadedTime ? now - domContentLoadedTime : 0,
                        pg_paused: self.pageVisibility.computedDuration,
                        pg_exp: domContentLoadedTime ? now - domContentLoadedTime - self.pageVisibility.computedDuration : 0,
                        vsbl: self.viewability.adagio.visible === true ? 1 : 0,
                        adsrv_vsbl: self.viewability.adserver.visible === true ? 1 : 0,
                        adsrv_att_delta: self.viewability.adserver.exposureDelta,
                        clk_time: self.viewability.adagio.exposureDurationOnClick != null 
                            ? self.viewability.adagio.exposureDurationOnClick 
                            : "",
                        reset: self.resetCounter,
                        adsrv_adu_exp: self.viewability.adserver.exposureDuration,
                        navs_ts: self.navigationStart != null ? self.navigationStart : "",
                        trgr_ts: self.ts != null ? parseInt(self.ts, 10) : "",
                        init_ts: self.initTime,
                        start_ts: self.startTime,
                        reset_ts: self.resetTime != null ? self.resetTime : "",
                        vsbl_ts: self.viewability.adagio.viewableSince != null 
                            ? self.viewability.adagio.viewableSince 
                            : "",
                        adsrv_vsbl_ts: self.viewability.adserver.viewableSince != null 
                            ? self.viewability.adserver.viewableSince 
                            : "",
                        auct_id: self.auctionId ? self.auctionId : ""
                    };
                    
                    // Add param fields
                    var paramFields = {};
                    for (var paramKey in self.params) {
                        if (Object.prototype.hasOwnProperty.call(PARAM_FIELD_MAPPINGS, paramKey)) {
                            paramFields[PARAM_FIELD_MAPPINGS[paramKey]] = self.params[paramKey] ? self.params[paramKey] : "";
                        }
                    }
                    
                    // Add feature fields
                    var featureFields = {
                        featv: self.featuresVersion
                    };
                    
                    for (var featureKey in self.features) {
                        if (Object.prototype.hasOwnProperty.call(FEATURE_FIELD_MAPPINGS, featureKey)) {
                            featureFields[FEATURE_FIELD_MAPPINGS[featureKey]] = self.features[featureKey];
                        } else {
                            featureFields[featureKey] = self.features[featureKey];
                        }
                    }
                    
                    // Set default print number
                    if (!featureFields.pn) {
                        featureFields.pn = 1;
                    }
                    
                    // Add navigation fields
                    var navigationFields = {
                        sess_lngth: self.navigationFeatures.sessionLength,
                        avg_sess_lngth: self.navigationFeatures.avgSessionLength,
                        sess_cnt: self.navigationFeatures.totalSessions,
                        rfr_fqdn: self.navigationFeatures.referrerFQDN,
                        prv_pgtyp: self.navigationFeatures.previousPagetype
                    };
                    
                    // Add ad server fields
                    var adServerFields = {};
                    for (var optionKey in self.options) {
                        if (Object.prototype.hasOwnProperty.call(ADSERVER_FIELD_MAPPINGS, optionKey)) {
                            adServerFields[ADSERVER_FIELD_MAPPINGS[optionKey]] = self.options[optionKey] 
                                ? self.options[optionKey] 
                                : "";
                        }
                    }
                    
                    // Combine all data
                    return Object.assign(beaconData, featureFields, navigationFields, paramFields, adServerFields);
                },
                events: events
            });
        }
    }
    // Additional methods would be defined here...
]);

/**
 * Measurers Manager - Manages multiple ViewabilityMeasurer instances
 * @class MeasurersManager
 */
window.ADAGIO.classes.MeasurersManager = utils.createClass(function MeasurersManager() {
    utils.assertInstance(this, window.ADAGIO.classes.MeasurersManager);
    this.measurers = {};
    this.init();
}, [
    {
        key: "init",
        value: function init() {
            // Initialize the manager
        }
    },
    {
        key: "store",
        value: function store(measurer) {
            var adUnitCode = measurer.params && measurer.params.adUnitCode 
                ? measurer.params.adUnitCode 
                : undefined;
                
            if (this.get(adUnitCode)) {
                return false;
            }
            
            this.measurers[adUnitCode] = measurer;
        }
    },
    {
        key: "get",
        value: function get(adUnitCode) {
            return adUnitCode ? this.measurers[adUnitCode] : this.measurers;
        }
    },
    {
        key: "has",
        value: function has(adUnitCode, auctionId) {
            var measurer = this.get(adUnitCode);
            return measurer && auctionId ? measurer.auctionId === auctionId : !!measurer;
        }
    },
    {
        key: "getByAdUnitElementId",
        value: function getByAdUnitElementId(elementId) {
            var self = this;
            var adUnitCodes = Object.keys(this.measurers);
            
            if (!adUnitCodes || !adUnitCodes.length) {
                return false;
            }
            
            return adUnitCodes.filter(function(adUnitCode) {
                return self.measurers[adUnitCode] && 
                       self.measurers[adUnitCode]._adUnitElementId === elementId;
            });
        }
    },
    {
        key: "remove",
        value: function remove(adUnitCode) {
            return delete this.measurers[adUnitCode];
        }
    }
]);
