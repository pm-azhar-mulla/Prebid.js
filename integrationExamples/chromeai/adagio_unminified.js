/**
 * ADAGIO Ad Measurement Library - v2.1.11
 * Provides viewability measurement and ad server integration for programmatic advertising
 */

var ADAGIO = (function(exports) {
    "use strict";

    // ========================================================================
    // UTILITY FUNCTIONS
    // ========================================================================
    
    /**
     * Gets object keys including symbol properties
     * @param {Object} obj - The object to get keys from
     * @param {boolean} enumerable - Whether to get enumerable properties only
     * @returns {Array} Array of keys
     */
    function getObjectKeysWithSymbols(obj, enumerable) {
        var keys = Object.keys(obj);
        
        if (Object.getOwnPropertySymbols) {
            var symbols = Object.getOwnPropertySymbols(obj);
            if (enumerable) {
                symbols = symbols.filter(function(symbol) {
                    return Object.getOwnPropertyDescriptor(obj, symbol).enumerable;
                });
            }
            keys.push.apply(keys, symbols);
        }
        
        return keys;
    }

    /**
     * Merges objects together (Object spread implementation)
     * @returns {Object} Merged object
     */
    function mergeObjects(target) {
        for (var i = 1; i < arguments.length; i++) {
            var source = arguments[i] != null ? arguments[i] : {};
            
            if (i % 2) {
                getObjectKeysWithSymbols(Object(source), true).forEach(function(key) {
                    defineProperty(target, key, source[key]);
                });
            } else if (Object.getOwnPropertyDescriptors) {
                Object.defineProperties(target, Object.getOwnPropertyDescriptors(source));
            } else {
                getObjectKeysWithSymbols(Object(source)).forEach(function(key) {
                    Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key));
                });
            }
        }
        
        return target;
    }

    /**
     * Converts value to primitive
     * @param {*} value - The value to convert
     * @returns {string|symbol} Primitive value
     */
    function toPrimitiveSymbol(value) {
        var primitive = function(value, hint) {
            if (typeof value !== "object" || !value) return value;
            
            var toPrimitive = value[Symbol.toPrimitive];
            if (toPrimitive !== undefined) {
                var result = toPrimitive.call(value, hint || "default");
                if (typeof result !== "object") return result;
                throw new TypeError("@@toPrimitive must return a primitive value.");
            }
            
            return (hint === "string" ? String : Number)(value);
        }(value, "string");
        
        return typeof primitive === "symbol" ? primitive : primitive + "";
    }

    /**
     * Enhanced typeof check
     * @param {*} value - The value to check
     * @returns {string} Type of the value
     */
    function getType(value) {
        return (getType = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" 
            ? function(value) { return typeof value; }
            : function(value) {
                return value && typeof Symbol === "function" && 
                    value.constructor === Symbol && value !== Symbol.prototype 
                    ? "symbol" 
                    : typeof value;
            })(value);
    }

    /**
     * Class instance check
     * @param {*} instance - The instance to check
     * @param {Function} Constructor - The constructor to check against
     */
    function assertInstance(instance, Constructor) {
        if (!(instance instanceof Constructor)) {
            throw new TypeError("Cannot call a class as a function");
        }
    }

    /**
     * Define properties on class prototype
     * @param {Object} target - The target object
     * @param {Array} props - The properties to define
     */
    function defineClassProperties(target, props) {
        for (var i = 0; i < props.length; i++) {
            var descriptor = props[i];
            descriptor.enumerable = descriptor.enumerable || false;
            descriptor.configurable = true;
            if ("value" in descriptor) descriptor.writable = true;
            Object.defineProperty(target, toPrimitiveSymbol(descriptor.key), descriptor);
        }
    }

    /**
     * Define class with methods and static properties
     * @param {Function} Constructor - The constructor function
     * @param {Array} instanceProps - Instance properties
     * @param {Array} staticProps - Static properties
     * @returns {Function} The constructor
     */
    function createClass(Constructor, instanceProps, staticProps) {
        if (instanceProps) defineClassProperties(Constructor.prototype, instanceProps);
        if (staticProps) defineClassProperties(Constructor, staticProps);
        Object.defineProperty(Constructor, "prototype", { writable: false });
        return Constructor;
    }

    /**
     * Define property on an object
     * @param {Object} obj - The target object
     * @param {string|symbol} key - The property key
     * @param {*} value - The property value
     * @returns {Object} The target object
     */
    function defineProperty(obj, key, value) {
        key = toPrimitiveSymbol(key);
        
        if (key in obj) {
            Object.defineProperty(obj, key, {
                value: value,
                enumerable: true,
                configurable: true,
                writable: true
            });
        } else {
            obj[key] = value;
        }
        
        return obj;
    }

    /**
     * Convert to array
     * @param {*} value - The value to convert
     * @returns {Array} Array from value
     */
    function toArray(value) {
        return Array.isArray(value) 
            ? arrayLikeToArray(value)
            : (typeof Symbol !== "undefined" && value[Symbol.iterator] || value["@@iterator"])
                ? Array.from(value)
                : iterableToArray(value) || (function() {
                    throw new TypeError(
                        "Invalid attempt to spread non-iterable instance.\n" +
                        "In order to be iterable, non-array objects must have a [Symbol.iterator]() method."
                    );
                })();
    }

    /**
     * Convert iterable to array
     * @param {*} value - The value to convert
     * @param {number} limit - The max length
     * @returns {Array|undefined} Array from iterable
     */
    function iterableToArray(value, limit) {
        if (!value) return;
        
        if (typeof value === "string") return arrayLikeToArray(value, limit);
        
        var className = Object.prototype.toString.call(value).slice(8, -1);
        if (className === "Object" && value.constructor) {
            className = value.constructor.name;
        }
        
        if (className === "Map" || className === "Set") {
            return Array.from(value);
        }
        
        if (className === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(className)) {
            return arrayLikeToArray(value, limit);
        }
    }

    /**
     * Convert array-like to array
     * @param {*} value - The value to convert
     * @param {number} limit - The max length
     * @returns {Array} New array
     */
    function arrayLikeToArray(value, limit) {
        if (limit == null || limit > value.length) limit = value.length;
        
        var result = new Array(limit);
        for (var i = 0; i < limit; i++) {
            result[i] = value[i];
        }
        
        return result;
    }

    // ========================================================================
    // CONSTANTS & CONFIGURATION
    // ========================================================================
    
    /**
     * Standard IAB ad sizes
     * @type {Array<string>}
     */
    var STANDARD_AD_SIZES = [
        "120x600", "160x600", "300x250", "300x600", "300x1050", 
        "600x250", "600x600", "728x90", "728x94", "728x315", 
        "800x600", "970x90", "970x250", "1000x200"
    ];
    
    /**
     * Element without IAB dimensions
     * @type {number}
     */
    var REASON_NOT_MEASURABLE_NO_IAB_DIMS = 0;
    
    /**
     * Element with IAB dimensions
     * @type {number}
     */
    var REASON_NOT_MEASURABLE_HAS_IAB_DIMS = 1;
    
    /**
     * Check if array
     * @type {Function}
     */
    var isArray = Array.isArray;
    
    /**
     * Get global object
     * @type {Object}
     */
    var globalObject = typeof global === "object" && 
        global && global.Object === Object && global;
    
    var selfObject = typeof self === "object" && 
        self && self.Object === Object && self;
        
    var root = globalObject || selfObject || Function("return this")();
    
    var Symbol = root.Symbol;
    var objectProto = Object.prototype;
    var hasOwnProperty = objectProto.hasOwnProperty;
    var toString = objectProto.toString;
    var symToStringTag = Symbol ? Symbol.toStringTag : undefined;
    
    /**
     * Endpoints for beacon collection
     * @type {Object}
     */
    var ENDPOINTS = {
        avw: "//c.4dex.tech/avw.gif"
    };
    
    /**
     * Blacklisted organization IDs
     * @type {Array}
     */
    var BLACKLISTED_ORG_IDS = [];
    
    /**
     * Check if sendBeacon API is available
     * @type {boolean}
     */
    var HAS_BEACON_API = !!navigator.sendBeacon;

    // ========================================================================
    // LOGGING UTILITIES
    // ========================================================================

    /**
     * Console styling for logs
     * @type {Object}
     */
    var LOG_STYLES = {
        default: "\n      background: #222;\n      color: #bada55;\n      border-radius: 4px 0 0 4px;\n      padding: 3px 4px 2px;\n      font-weight: normal;\n  ",
        reset: "\n      background: transparent;\n      color: inherit;\n      border-radius: 0;\n      padding: 0;\n      font-weight: normal;\n  ",
        debug: "\n      background: palegreen;\n      color: darkgreen;\n      border-radius: 0 4px 4px 0;\n      padding: 3px 4px 2px;\n      margin-right: 10px;\n      font-weight: normal;\n  ",
        warn: "\n      background: lightcoral;\n      color: moccasin;\n      border-radius: 0 4px 4px 0;\n      padding: 3px 4px 2px;\n      margin-right: 10px;\n      font-weight: normal;\n  ",
        error: "\n      background: firebrick;\n      color: gainsboro;\n      border-radius: 0 4px 4px 0;\n      padding: 3px 4px 2px;\n      margin-right: 10px;\n      font-weight: normal;\n  "
    };

    /**
     * General logging utility
     * @param {string} level - Log level
     * @param {...*} args - Log arguments
     */
    function log(level) {
        level = level || "debug";
        
        var args = Array.prototype.slice.call(arguments, 1);
        
        if (typeof args[0] === "string") {
            if (args[1]) {
                console.log("%cADG%c" + level.toUpperCase() + " %c%s", 
                    LOG_STYLES.default, LOG_STYLES[level], LOG_STYLES.reset, args[0]);
                args.shift();
                args.map(function(arg) {
                    console.log(arg);
                });
            } else {
                console.log("%cADG%c" + level.toUpperCase() + " %c%s", 
                    LOG_STYLES.default, LOG_STYLES[level], LOG_STYLES.reset, args[0]);
            }
        } else {
            console.log.apply(console, ["%cADG%c" + level.toUpperCase(), 
                LOG_STYLES.default, LOG_STYLES[level]].concat(args));
        }
    }

    /**
     * Check if debug mode is enabled
     * @returns {boolean} Is debug mode enabled
     */
    function isDebugEnabled() {
        var win = getTopWindow();
        return win && win.localStorage && win.localStorage.getItem("ADAGIO_DEV_DEBUG");
    }

    /**
     * Log warning message
     * @param {...*} args - Warning arguments
     */
    function logWarning() {
        if (isDebugEnabled()) {
            var args = Array.prototype.slice.call(arguments);
            log.apply(void 0, ["warn"].concat(args));
        }
    }

    /**
     * Log error message
     * @param {...*} args - Error arguments
     */
    function logError() {
        if (isDebugEnabled()) {
            var args = Array.prototype.slice.call(arguments);
            log.apply(void 0, ["error"].concat(args));
        }
    }

    /**
     * Log debug message
     * @param {...*} args - Debug arguments
     */
    function logDebug() {
        if (isDebugEnabled()) {
            var args = Array.prototype.slice.call(arguments);
            log.apply(void 0, ["debug"].concat(args));
        }
    }

    // ========================================================================
    // COMMON UTILITY FUNCTIONS
    // ========================================================================

    /**
     * Generate UUID v4
     * @returns {string} UUID
     */
    function generateUUID(seed) {
        return seed 
            ? (seed ^ (Math.random() * 16) >> seed / 4).toString(16)
            : ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, generateUUID);
    }

    /**
     * Get top window safely
     * @returns {Window} Top window
     */
    function getTopWindow() {
        try {
            if (window.top.location.href) {
                return window.top;
            }
        } catch (e) {
            return false;
        }
        return window.self;
    }

    /**
     * Detect device type
     * @returns {string} Device type: "desktop", "mobile", or "tablet"
     */
    function detectDeviceType() {
        var userAgent = getTopWindow().navigator.userAgent;
        var deviceType, deviceTypeCode;
        
        // Detect device type
        if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(userAgent)) {
            deviceTypeCode = 5;
        } else if (/Mobile|iP(hone|od|ad)|Android|BlackBerry|IEMobile|Kindle|NetFront|Silk-Accelerated|(hpw|web)OS|Fennec|Minimo|Opera M(obi|ini)|Blazer|Dolfin|Dolphin|Skyfire|Zune/.test(userAgent)) {
            deviceTypeCode = 4;
        } else {
            deviceTypeCode = 2;
        }
        
        // Convert to friendly name
        switch (deviceTypeCode) {
            case 2:
                deviceType = "desktop";
                break;
            case 4:
                deviceType = "mobile";
                break;
            case 5:
                deviceType = "tablet";
                break;
        }
        
        return deviceType;
    }

    /**
     * Parse URI
     * @param {string} uri - URI to parse
     * @returns {Object|boolean} Parsed URI or false if invalid
     */
    function parseURI(uri) {
        if (typeof uri !== "string" || uri.slice(0, 4) !== "http") {
            logDebug("uriParser: unable to parse uri, invalid", uri);
            return false;
        }
        
        var a = document.createElement("a");
        var queryParams = {};
        a.href = uri;
        
        // Parse query parameters
        var queryParts = a.search.slice(1).split("&");
        for (var i = 0, len = queryParts.length; i < len; i++) {
            var param = queryParts[i].split("=");
            queryParams[param[0]] = param[1];
        }
        
        return {
            protocol: a.protocol,
            hostname: a.hostname,
            port: a.port,
            pathname: a.pathname,
            search: a.search,
            searchParsed: queryParams,
            hash: a.hash,
            host: a.host
        };
    }

    /**
     * Get DOM Content Loaded time
     * @returns {number|null} Timestamp or null
     */
    function getDomContentLoadedTime() {
        var win = getTopWindow();
        var performance = win.performance || 
            win.msPerformance || 
            win.webkitPerformance || 
            win.mozPerformance;
            
        return performance && 
            performance.timing && 
            performance.timing.domContentLoadedEventStart > 0 
                ? performance.timing.domContentLoadedEventStart 
                : null;
    }

    // ========================================================================
    // STORAGE MANAGER
    // ========================================================================

    /**
     * Storage Manager - Wrapper around localStorage
     * @class StorageManager
     */
    var StorageManager = createClass(function StorageManager() {
        assertInstance(this, StorageManager);
        this.init();
    }, [
        {
            key: "init",
            value: function init() {
                this.w = window;
                this.create();
            }
        },
        {
            key: "create",
            value: function create() {
                if (!this.w.localStorage.getItem("adagio")) {
                    this.w.localStorage.setItem("adagio", JSON.stringify({}));
                }
            }
        },
        {
            key: "insureSchema",
            value: function insureSchema() {
                var data = this.w.localStorage.getItem("adagio");
                try {
                    if (!(!data || !JSON.parse(data))) return;
                    
                    this.w.localStorage.removeItem("adagio");
                    this.create();
                } catch (e) {
                    this.w.localStorage.removeItem("adagio");
                    this.create();
                }
            }
        },
        {
            key: "get",
            value: function get(path) {
                this.insureSchema();
                
                var data = JSON.parse(this.w.localStorage.getItem("adagio"));
                if (!path) {
                    return data;
                }
                
                return hasPathInObject(data, path) 
                    ? getValueAtPath(data, path) 
                    : null;
            }
        },
        {
            key: "store",
            value: function store(path, value) {
                this.insureSchema();
                
                var data = JSON.parse(this.w.localStorage.getItem("adagio"));
                setValueAtPath(data, path, value);
                this.w.localStorage.setItem("adagio", JSON.stringify(data));
            }
        },
        {
            key: "unset",
            value: function unset(path) {
                var data = JSON.parse(this.w.localStorage.getItem("adagio"));
                unsetPathInObject(data, path);
                this.w.localStorage.setItem("adagio", JSON.stringify(data));
            }
        }
    ]);
    
    // More code would continue here...

    // ========================================================================
    // MODULE EXPORTS
    // ========================================================================
    
    // Set start time for performance measurement
    exports.adagioStartTime = Date.now();
    
    // Initialize ADAGIO
    (function() {
        var win = getTopWindow();
        try {
            var currentScript = document.currentScript;
            if (currentScript && currentScript.id && currentScript.id.startsWith("adagiojs-")) {
                logDebug("remove adagioScript from localStorage");
                win.localStorage.removeItem("adagioScript");
            }
        } catch (e) {
            logError(e);
        }
        
        if (win.ADAGIO && win.ADAGIO.hasRtd === true) {
            return;
        }
        
        // Initialize ADAGIO namespace
        win.ADAGIO = win.ADAGIO || {};
        win.ADAGIO.versions = win.ADAGIO.versions || {};
        win.ADAGIO.versions.adagiojs = "2.1.11";
        win.ADAGIO.pageviewId = win.ADAGIO.pageviewId || generateUUID();
        
        // Initialize services
        var sessionManager = new SessionManager();
        var navigationManager = new NavigationManager();
        var featuresManager = new FeaturesManager();
        var measurersManager = new MeasurersManager();
        
        logDebug("adagio.js loaded: vers. " + "2.1.11");
        win.ADAGIO.loaded = true;
    })();
    
    // Expose queue history in dev mode
    var queueHistory = getTopWindow()._ADAGIO && getTopWindow()._ADAGIO.queueHistory 
        ? getTopWindow()._ADAGIO.queueHistory 
        : [];
    
    exports.queueHistory = queueHistory;
    
    return exports;
})({});

// Set global reference
try {
    window.top.location.href ? top._ADAGIO = ADAGIO : window._ADAGIO = ADAGIO;
} catch (e) {}
