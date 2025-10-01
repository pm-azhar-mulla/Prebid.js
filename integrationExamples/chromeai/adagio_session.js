/**
 * ADAGIO Session and Navigation Management Components
 * Part of the ADAGIO measurement library
 */

// Use the global ADAGIO namespace
var utils = window.ADAGIO.utils;

// ========================================================================
// SESSION MANAGER
// ========================================================================

/**
 * Session Manager - Handles user session data and persistence
 * @class SessionManager
 */
window.ADAGIO.classes.SessionManager = utils.createClass(function SessionManager() {
    utils.assertInstance(this, window.ADAGIO.classes.SessionManager);
    this.storage = new window.ADAGIO.classes.StorageManager();
    this.maxTimeSession = 1800000; // 30 minutes
    this._ensureSchema();
}, [
    {
        key: "_ensureSchema",
        value: function _ensureSchema() {
            var navData = this.storage.get("navigation");
            var sessionData = this.storage.get("navigation.session");
            
            // Migrate old format to new schema
            if (sessionData) {
                if (sessionData.sampling) {
                    try {
                        var avwSampling = sessionData.sampling.avw;
                        var avwRate = sessionData.sampling.rates.avw;
                        
                        sessionData.rnd = avwSampling === true ? avwRate + 0.01 : avwRate - 0.01;
                        sessionData.vwSmplg = avwRate;
                        sessionData.vwSmplgNxt = navData && navData.nextSamplingRates && navData.nextSamplingRates.avw 
                            ? navData.nextSamplingRates.avw 
                            : avwRate;
                        sessionData._firstPageviewId = sessionData.sampling.firstPageviewId;
                        sessionData._bidsSmplg = 0.1;
                        sessionData._currentPagetype = sessionData.currentPagetype;
                        sessionData._previousPagetype = sessionData.previousPagetype;
                        
                        delete sessionData.sampling;
                        delete sessionData.currentPagetype;
                        delete sessionData.previousPagetype;
                    } catch (e) {
                        // Ignore migration errors
                    }
                }
                
                this.storage.store("session", sessionData);
                this.storage.unset("navigation.session");
                delete navData.session;
                delete navData.nextSamplingRates;
            }
            
            if (navData) {
                this.storage.store("_navigation", navData);
                this.storage.unset("navigation");
            }
        }
    },
    {
        key: "startOrUpdate",
        value: function startOrUpdate(config) {
            var self = this;
            var currentTime = Date.now();
            var navData = this.storage.get("_navigation");
            var sessionData = this.storage.get("session");
            var isV2 = config && config.v && config.v >= 2;
            
            try {
                // Check if we need to start a new session or update existing one
                if (!navData || 
                    !sessionData || 
                    (isV2 ? config.isNew : config.isNew && config.initiator) || 
                    typeof sessionData.vwSmplg !== "number" ||
                    (isV2 
                        ? typeof sessionData.expiry === "number" && currentTime > sessionData.expiry 
                        : typeof sessionData.lastActivityTime === "number" && 
                          currentTime - sessionData.lastActivityTime > self.maxTimeSession)) {
                    this.start(config);
                } else {
                    this.update(config);
                }
            } catch (e) {
                utils.logDebug(e);
            }
        }
    },
    {
        key: "start",
        value: function start(config) {
            var navData = this.storage.get("_navigation") || {};
            var totalPages = parseInt(navData.totalPages, 10) || 0;
            var totalSessions = parseInt(navData.totalSessions, 10) || 0;
            var oldSession = this.storage.get("session") || {};
            
            // Update navigation counters
            this.storage.store("_navigation.totalPages", totalPages + 1);
            this.storage.store("_navigation.totalSessions", totalSessions + 1);
            
            var currentTime = Date.now();
            var samplingRate = oldSession.vwSmplgNxt || 0.1;
            var isV2 = config && config.v && config.v >= 2;
            
            var random, sessionId, testName, testVersion;
            
            if (isV2) {
                random = config && config.rnd ? config.rnd : Math.random();
                sessionId = config && config.id ? config.id : utils.generateUUID();
            } else if (Object.keys(oldSession).length && oldSession.initiator === "snippet") {
                // Preserve values from snippet initiator
                sessionId = oldSession.id;
                random = oldSession.rnd;
                testName = oldSession.testName;
                testVersion = oldSession.testVersion;
            } else {
                sessionId = config && config.id ? config.id : utils.generateUUID();
                random = config && config.rnd ? config.rnd : Math.random();
            }
            
            // Create new session object
            var session = {
                _firstPageviewId: null,
                _currentPagetype: null,
                _previousPagetype: null,
                _bidsSmplg: 0.1,
                pages: 1,
                rnd: random,
                id: sessionId,
                new: true,
                vwSmplg: samplingRate,
                vwSmplgNxt: samplingRate
            };
            
            // Add version-specific properties
            session.expiry = currentTime + this.maxTimeSession;
            
            if (isV2) {
                session._v = 2;
            } else {
                session.lastActivityTime = currentTime;
                session.initiator = "adgjs";
                
                if (testName) {
                    session.testName = testName;
                }
                
                if (testVersion) {
                    session.testVersion = testVersion;
                }
            }
            
            this.storage.store("session", session);
        }
    },
    {
        key: "update",
        value: function update(config) {
            var currentTime = Date.now();
            var navData = this.storage.get("_navigation");
            var session = this.storage.get("session");
            
            if (!navData || !session) {
                throw new Error("Key missing in localStorage");
            }
            
            var isV2 = session._v && session._v >= 2 || config && config.v && config.v >= 2;
            
            // Clean up legacy properties in v2
            if (isV2) {
                this.storage.unset("session.testName");
                this.storage.unset("session.testVersion");
                this.storage.unset("session.lastActivityTime");
                this.storage.store("session._v", 2);
            }
            
            // Handle legacy _pages property
            if (session._pages) {
                session.pages = session._pages;
                this.storage.unset("session._pages");
            }
            
            var pageCount = parseInt(session.pages, 10) || 0;
            var totalPages = parseInt(navData.totalPages, 10) || 0;
            
            // Update session
            this.storage.store("session.expiry", currentTime + this.maxTimeSession);
            
            if (!isV2) {
                this.storage.store("session.lastActivityTime", currentTime);
                this.storage.store("session.initiator", "adgjs");
            }
            
            this.storage.store("session.new", false);
            this.storage.store("session.pages", pageCount + 1);
            this.storage.store("_navigation.totalPages", totalPages + 1);
        }
    },
    {
        key: "setVwSamplingNext",
        value: function setVwSamplingNext(rate) {
            this.storage.store("session.vwSmplgNxt", rate);
        }
    },
    {
        key: "setSampling",
        value: function setSampling(pageviewId, config) {
            var firstPageviewId = this.storage.get("session._firstPageviewId");
            
            if (!this.storage.get("session.rnd")) {
                throw new Error("The key rnd has not been found");
            }
            
            if (firstPageviewId) {
                if (firstPageviewId === pageviewId && 
                    config && 
                    typeof config.vwSmplgNxt === "number" && 
                    config.vwSmplgNxt >= 0) {
                    this.storage.store("session.vwSmplg", config.vwSmplgNxt);
                    this.storage.store("session.vwSmplgNxt", config.vwSmplgNxt);
                }
            } else {
                this.storage.store("session._firstPageviewId", pageviewId);
            }
        }
    }
]);

// ========================================================================
// NAVIGATION MANAGER
// ========================================================================

/**
 * Navigation Manager - Tracks user navigation and session information
 * @class NavigationManager
 */
window.ADAGIO.classes.NavigationManager = utils.createClass(function NavigationManager() {
    utils.assertInstance(this, window.ADAGIO.classes.NavigationManager);
    this._storage = new window.ADAGIO.classes.StorageManager();
}, [
    {
        key: "sessionLength",
        get: function() {
            return this._storage.get("session.pages") || 1;
        }
    },
    {
        key: "avgSessionLength",
        get: function() {
            var totalSessions = parseInt(this._storage.get("_navigation.totalSessions"), 10) || 1;
            return (parseInt(this._storage.get("_navigation.totalPages"), 10) || 1) / totalSessions;
        }
    },
    {
        key: "referrerFQDN",
        get: function() {
            var fqdn = "";
            
            if (utils.isTopAccessible()) {
                var referrer = window.top.document.referrer;
                if (referrer) {
                    fqdn = utils.parseURI(referrer).hostname;
                }
            }
            
            return fqdn;
        }
    },
    {
        key: "totalSessions",
        get: function() {
            return this._storage.get("_navigation.totalSessions") || 1;
        }
    },
    {
        key: "previousPagetype",
        get: function() {
            return this._storage.get("session._previousPagetype");
        }
    },
    {
        key: "currentPagetype",
        get: function() {
            return this._storage.get("session._currentPagetype");
        }
    },
    {
        key: "allowBeaconSending",
        value: function allowBeaconSending(beaconType, customRate) {
            if (["avw", "bids"].indexOf(beaconType) === -1) {
                return true;
            }
            
            var samplingRate;
            
            switch (beaconType) {
                case "bids":
                    samplingRate = typeof customRate === "number" 
                        ? customRate 
                        : this._storage.get("session._bidsSmplg");
                        
                    if (this._storage.get("session.vwSmplg") === 0) {
                        samplingRate = 0;
                    }
                    break;
                    
                case "avw":
                    samplingRate = this._storage.get("session.vwSmplg");
                    break;
            }
            
            var random = this._storage.get("session.rnd");
            
            return typeof samplingRate !== "number" || 
                typeof random !== "number" || 
                random < samplingRate;
        }
    },
    {
        key: "pageType",
        set: function(pageType) {
            var currentType = this.currentPagetype;
            
            if (currentType != null) {
                this._storage.store("session._previousPagetype", currentType);
            }
            
            this._storage.store("session._currentPagetype", pageType);
        }
    }
]);
