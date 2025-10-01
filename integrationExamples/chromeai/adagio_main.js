/**
 * ADAGIO Main Integration File
 * @version 2.1.11
 * 
 * This is the main entry point that integrates all components of ADAGIO
 */

// Use the global ADAGIO namespace
var utils = window.ADAGIO.utils;

// Set start time for performance tracking
(function(exports) {
    "use strict";
    
    // Record start time
    exports.adagioStartTime = Date.now();
    
    /**
     * Initialize the ADAGIO library
     */
    function initialize() {
        utils.logDebug("Initialize adagio.js");
        
        var win = utils.getTopWindow();
        var sessionManager = new window.ADAGIO.classes.SessionManager();
        var navigationManager = new window.ADAGIO.classes.NavigationManager();
        var featuresManager = new window.ADAGIO.classes.FeaturesManager();
        var measurersManager = new window.ADAGIO.classes.MeasurersManager();
        
        // Setup ADAGIO namespace
        win.ADAGIO = win.ADAGIO || {};
        win.ADAGIO.versions = win.ADAGIO.versions || {};
        win.ADAGIO.versions.adagiojs = "2.1.11";
        win.ADAGIO.pageviewId = win.ADAGIO.pageviewId || utils.generateUUID();
        win.ADAGIO.features = win.ADAGIO.features || featuresManager;
        win.ADAGIO.spl = win.ADAGIO.spl || {};
        win.ADAGIO.spl.avw = win.ADAGIO.spl.avw || false;
        win.ADAGIO.spl.bids = win.ADAGIO.spl.bids || false;
        win.ADAGIO.queue = win.ADAGIO.queue || [];
        win.ADAGIO.windows = win.ADAGIO.windows || [];
        
        // Listen for measurement events
        win.document.addEventListener("adagio.measure.afterStart", function(e) {
            measurersManager.store(e.detail.measure);
        });
        
        // Process existing queue
        while (win.ADAGIO.queue.length) {
            processQueueItem(win.ADAGIO.queue.shift(), {
                navigationFeatures: navigationManager,
                adagioNavigation: sessionManager,
                featuresManager: featuresManager,
                measurersManager: measurersManager
            });
        }
        
        // Override push method to process new items
        win.ADAGIO.queue.push = function(item) {
            try {
                processQueueItem(item, {
                    navigationFeatures: navigationManager,
                    adagioNavigation: sessionManager,
                    featuresManager: featuresManager,
                    measurersManager: measurersManager
                });
            } catch (e) {
                utils.logError("process queue", item.action, e);
            }
        };
    }
    
    /**
     * Initialize ad server integrations (DFP, SAS, AppNexus)
     */
    window.ADAGIO.utils.initAdServerIntegrations = function() {
        var eventTypes = {
            GPT: {
                IMPRESSION_VIEWABLE: "impressionViewable",
                SLOT_ON_LOAD: "slotOnload",
                SLOT_RENDER_ENDED: "slotRenderEnded",
                SLOT_REQUESTED: "slotRequested",
                SLOT_RESPONSE_RECEIVED: "slotResponseReceived",
                SLOT_VISIBILITY_CHANGED: "slotVisibilityChanged"
            },
            SAS: {
                CALL: "call",
                CLEAN: "clean",
                BEFORE_RENDER: "beforeRender",
                CMP_ANSWERED: "CmpAnswered",
                CMP_CALLED: "CmpCalled",
                LOAD: "load",
                NOAD: "noad",
                RENDER: "render",
                RESET: "reset",
                AD: "ad",
                SET_HEADER_BIDDING_WINNER: "setHeaderBiddingWinner"
            },
            AST: {
                adRequested: "adRequested",
                adAvailable: "adAvailable",
                adBadRequest: "adBadRequest",
                adLoaded: "adLoaded",
                adNoBid: "adNoBid",
                adRequestFailure: "adRequestFailure",
                adError: "adError",
                adCollapse: "adCollapse"
            }
        };
        
        var win = utils.getTopWindow();
        win.ADAGIO = win.ADAGIO || {};
        win.ADAGIO.windows = win.ADAGIO.windows || [];
        
        var currentWin = window.self;
        var windowEntry = win.ADAGIO.windows.find(function(entry) {
            return entry.self === currentWin;
        });
        
        if (!windowEntry) {
            windowEntry = {
                self: currentWin
            };
            win.ADAGIO.windows.push(windowEntry);
        }
        
        // Google Publisher Tags (DFP) integration
        try {
            if (windowEntry.gpt === true || windowEntry.adserver === "gpt") {
                return;
            }
            
            currentWin.googletag = currentWin.googletag || {};
            currentWin.googletag.cmd = currentWin.googletag.cmd || [];
            
            currentWin.googletag.cmd.push(function() {
                Object.keys(eventTypes.GPT)
                    .map(function(key) {
                        return eventTypes.GPT[key];
                    })
                    .forEach(function(eventName) {
                        currentWin.googletag.pubads().addEventListener(eventName, function(args) {
                            win.ADAGIO.queue.push({
                                action: "gpt-event",
                                data: {
                                    eventName: eventName,
                                    args: args,
                                    _window: currentWin
                                },
                                ts: Date.now()
                            });
                        });
                    });
                
                windowEntry.gpt = true;
                windowEntry.adserver = "gpt";
            });
        } catch (e) {
            // Ignore errors
        }
        
        // Smart Ad Server integration
        try {
            if (windowEntry.sas === true || windowEntry.adserver === "sas") {
                return;
            }
            
            currentWin.sas = currentWin.sas || {};
            currentWin.sas.cmd = currentWin.sas.cmd || [];
            
            currentWin.sas.cmd.push(function() {
                Object.keys(eventTypes.SAS)
                    .map(function(key) {
                        return eventTypes.SAS[key];
                    })
                    .forEach(function(eventName) {
                        currentWin.sas.events.on(eventName, function(args) {
                            win.ADAGIO.queue.push({
                                action: "sas-event",
                                data: {
                                    eventName: eventName,
                                    args: args,
                                    _window: currentWin
                                },
                                ts: Date.now()
                            });
                        });
                    });
                
                windowEntry.sas = true;
                windowEntry.adserver = "sas";
            });
        } catch (e) {
            // Ignore errors
        }
        
        // AppNexus Tag integration
        try {
            if (windowEntry.ast === true || windowEntry.adserver === "ast") {
                return;
            }
            
            currentWin.apntag = currentWin.apntag || {};
            currentWin.apntag.anq = currentWin.apntag.anq || [];
            
            currentWin.apntag.anq.push(function() {
                Object.keys(eventTypes.AST)
                    .map(function(key) {
                        return eventTypes.AST[key];
                    })
                    .forEach(function(eventName) {
                        currentWin.apntag.onEvent(eventName, function() {
                            win.ADAGIO.queue.push({
                                action: "ast-event",
                                data: {
                                    eventName: eventName,
                                    args: arguments,
                                    _window: currentWin
                                },
                                ts: Date.now()
                            });
                        });
                    });
                
                windowEntry.ast = true;
                windowEntry.adserver = "ast";
            });
        } catch (e) {
            // Ignore errors
        }
    }
    
    /**
     * Process an item from the ADAGIO queue
     * @param {Object} item - Queue item
     * @param {Object} services - ADAGIO services
     */
    function processQueueItem(item, services) {
        var navigationFeatures = services.navigationFeatures;
        var sessionManager = services.adagioNavigation;
        var featuresManager = services.featuresManager;
        var measurersManager = services.measurersManager;
        var win = utils.getTopWindow();
        
        // Log queue history in debug mode
        if (utils.isDebugEnabled() && item.action !== "pb-analytics-event") {
            win._ADAGIO = win._ADAGIO || {};
            win._ADAGIO.queueHistory = win._ADAGIO.queueHistory || [];
            win._ADAGIO.queueHistory.push(item);
            
            if (win._ADAGIO.queueHistory.length > 100) {
                win._ADAGIO.queueHistory.shift();
            }
        }
        
        // Verify queue item has action
        if (getType(item) !== "object" || !item.action) {
            return false;
        }
        
        // Handle different action types
        switch (item.action) {
            case "ssp-data":
                handleSSPData(item.data, sessionManager);
                break;
                
            case "features":
                if (item.data.adUnitCode) {
                    featuresManager.store(item.data, true);
                } else {
                    Object.keys(item.data).map(function(key) {
                        featuresManager.storeLegacy(key, item.data[key], true);
                    });
                }
                break;
                
            case "store":
                handleStoreAction(item, featuresManager);
                break;
                
            case "gpt-event":
                handleGPTEvent(item, featuresManager, measurersManager, navigationFeatures);
                break;
                
            case "sas-event":
                handleSASEvent(item, featuresManager, measurersManager, navigationFeatures);
                break;
                
            case "ast-event":
                handleASTEvent(item, featuresManager, measurersManager, navigationFeatures);
                break;
                
            case "reset":
                handleResetAction(measurersManager);
                break;
                
            case "session":
                handleSessionAction(item, sessionManager, win);
                break;
                
            default:
                utils.logWarning('queue: Unknown action "' + item.action + '" in payload ' + item);
        }
    }
    
    // Main initialization
    (function() {
        var win = utils.getTopWindow();
        
        // Check for script element that should be removed
        try {
            var currentScript = document.currentScript;
            if (currentScript && currentScript.id && currentScript.id.startsWith("adagiojs-")) {
                utils.logDebug("remove adagioScript from localStorage");
                win.localStorage.removeItem("adagioScript");
            }
        } catch (e) {
            utils.logError(e);
        }
        
        // Check if already loaded
        if (win.ADAGIO && win.ADAGIO.loaded === true) {
            utils.logDebug("adagio.js already loaded");
            return;
        }
        
        // Initialize ad server integrations if not already done
        if (!win.ADAGIO || win.ADAGIO.hasRtd !== true) {
            window.ADAGIO.utils.initAdServerIntegrations();
        }
        
        // Initialize main functionality
        initialize();
        
        utils.logDebug("adagio.js loaded: vers. " + "2.1.11");
        win.ADAGIO.loaded = true;
    })();
    
    // Store queue history in debug mode
    var queueHistory = utils.getTopWindow()._ADAGIO && utils.getTopWindow()._ADAGIO.queueHistory 
        ? utils.getTopWindow()._ADAGIO.queueHistory 
        : [];
        
    exports.queueHistory = queueHistory;
    
    return exports;
})(window.ADAGIO);

// Set global reference
try {
    window.top.location.href ? top._ADAGIO = window.ADAGIO : window._ADAGIO = window.ADAGIO;
} catch (e) {
    // Failed to access top window
}
