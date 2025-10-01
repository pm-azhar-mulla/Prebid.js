/**
 * ADAGIO Core - v2.1.11
 * Base utility functions and shared components
 */

// Create global ADAGIO namespace
window.ADAGIO = window.ADAGIO || {};

// Core utilities namespace
window.ADAGIO.utils = {};
window.ADAGIO.classes = {};

/**
 * Enhanced typeof check
 * @param {*} value - The value to check
 * @returns {string} Type of the value
 */
window.ADAGIO.utils.getType = function(value) {
    return (typeof Symbol === "function" && typeof Symbol.iterator === "symbol" 
        ? function(value) { return typeof value; }
        : function(value) {
            return value && typeof Symbol === "function" && 
                value.constructor === Symbol && value !== Symbol.prototype 
                ? "symbol" 
                : typeof value;
        })(value);
};

/**
 * Check if value is instance of constructor
 * @param {*} instance - The instance to check
 * @param {Function} Constructor - The constructor to check against
 */
window.ADAGIO.utils.assertInstance = function(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
        throw new TypeError("Cannot call a class as a function");
    }
};

/**
 * Converts value to primitive
 * @param {*} value - The value to convert
 * @returns {string|symbol} Primitive value
 */
window.ADAGIO.utils.toPrimitiveSymbol = function(value) {
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
};

/**
 * Define properties on class prototype
 * @param {Object} target - The target object
 * @param {Array} props - The properties to define
 */
window.ADAGIO.utils.defineClassProperties = function(target, props) {
    for (var i = 0; i < props.length; i++) {
        var descriptor = props[i];
        descriptor.enumerable = descriptor.enumerable || false;
        descriptor.configurable = true;
        if ("value" in descriptor) descriptor.writable = true;
        Object.defineProperty(target, window.ADAGIO.utils.toPrimitiveSymbol(descriptor.key), descriptor);
    }
};

/**
 * Define class with methods and static properties
 * @param {Function} Constructor - The constructor function
 * @param {Array} instanceProps - Instance properties
 * @param {Array} staticProps - Static properties
 * @returns {Function} The constructor
 */
window.ADAGIO.utils.createClass = function(Constructor, instanceProps, staticProps) {
    if (instanceProps) window.ADAGIO.utils.defineClassProperties(Constructor.prototype, instanceProps);
    if (staticProps) window.ADAGIO.utils.defineClassProperties(Constructor, staticProps);
    Object.defineProperty(Constructor, "prototype", { writable: false });
    return Constructor;
};

/**
 * Define property on an object
 * @param {Object} obj - The target object
 * @param {string|symbol} key - The property key
 * @param {*} value - The property value
 * @returns {Object} The target object
 */
window.ADAGIO.utils.defineProperty = function(obj, key, value) {
    key = window.ADAGIO.utils.toPrimitiveSymbol(key);
    
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
};

/**
 * Gets object keys including symbol properties
 * @param {Object} obj - The object to get keys from
 * @param {boolean} enumerable - Whether to get enumerable properties only
 * @returns {Array} Array of keys
 */
window.ADAGIO.utils.getObjectKeysWithSymbols = function(obj, enumerable) {
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
};

/**
 * Merges objects together (Object spread implementation)
 * @returns {Object} Merged object
 */
window.ADAGIO.utils.mergeObjects = function(target) {
    for (var i = 1; i < arguments.length; i++) {
        var source = arguments[i] != null ? arguments[i] : {};
        
        if (i % 2) {
            window.ADAGIO.utils.getObjectKeysWithSymbols(Object(source), true).forEach(function(key) {
                window.ADAGIO.utils.defineProperty(target, key, source[key]);
            });
        } else if (Object.getOwnPropertyDescriptors) {
            Object.defineProperties(target, Object.getOwnPropertyDescriptors(source));
        } else {
            window.ADAGIO.utils.getObjectKeysWithSymbols(Object(source)).forEach(function(key) {
                Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key));
            });
        }
    }
    
    return target;
};

/**
 * Get top window safely
 * @returns {Window} Top window
 */
window.ADAGIO.utils.getTopWindow = function() {
    try {
        if (window.top.location.href) {
            return window.top;
        }
    } catch (e) {
        return false;
    }
    return window.self;
};

/**
 * Check if top window is accessible
 * @returns {boolean} Whether top window is accessible
 */
window.ADAGIO.utils.isTopAccessible = function() {
    try {
        if (window.top.location.href) {
            return true;
        }
    } catch (e) {
        return false;
    }
};

/**
 * Generate UUID v4
 * @returns {string} UUID
 */
window.ADAGIO.utils.generateUUID = function(seed) {
    return seed 
        ? (seed ^ (Math.random() * 16) >> seed / 4).toString(16)
        : ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, window.ADAGIO.utils.generateUUID);
};

/**
 * Console styling for logs
 * @type {Object}
 */
window.ADAGIO.logStyles = {
    default: "\n      background: #222;\n      color: #bada55;\n      border-radius: 4px 0 0 4px;\n      padding: 3px 4px 2px;\n      font-weight: normal;\n  ",
    reset: "\n      background: transparent;\n      color: inherit;\n      border-radius: 0;\n      padding: 0;\n      font-weight: normal;\n  ",
    debug: "\n      background: palegreen;\n      color: darkgreen;\n      border-radius: 0 4px 4px 0;\n      padding: 3px 4px 2px;\n      margin-right: 10px;\n      font-weight: normal;\n  ",
    warn: "\n      background: lightcoral;\n      color: moccasin;\n      border-radius: 0 4px 4px 0;\n      padding: 3px 4px 2px;\n      margin-right: 10px;\n      font-weight: normal;\n  ",
    error: "\n      background: firebrick;\n      color: gainsboro;\n      border-radius: 0 4px 4px 0;\n      padding: 3px 4px 2px;\n      margin-right: 10px;\n      font-weight: normal;\n  "
};

/**
 * Check if debug mode is enabled
 * @returns {boolean} Is debug mode enabled
 */
window.ADAGIO.utils.isDebugEnabled = function() {
    var win = window.ADAGIO.utils.getTopWindow();
    return win && win.localStorage && win.localStorage.getItem("ADAGIO_DEV_DEBUG");
};

/**
 * General logging utility
 * @param {string} level - Log level
 * @param {...*} args - Log arguments
 */
window.ADAGIO.utils.log = function(level) {
    level = level || "debug";
    
    var args = Array.prototype.slice.call(arguments, 1);
    
    if (typeof args[0] === "string") {
        if (args[1]) {
            console.log("%cADG%c" + level.toUpperCase() + " %c%s", 
                window.ADAGIO.logStyles.default, 
                window.ADAGIO.logStyles[level], 
                window.ADAGIO.logStyles.reset, 
                args[0]);
            args.shift();
            args.map(function(arg) {
                console.log(arg);
            });
        } else {
            console.log("%cADG%c" + level.toUpperCase() + " %c%s", 
                window.ADAGIO.logStyles.default, 
                window.ADAGIO.logStyles[level], 
                window.ADAGIO.logStyles.reset, 
                args[0]);
        }
    } else {
        console.log.apply(console, ["%cADG%c" + level.toUpperCase(), 
            window.ADAGIO.logStyles.default, 
            window.ADAGIO.logStyles[level]].concat(args));
    }
};

/**
 * Log debug message
 * @param {...*} args - Debug arguments
 */
window.ADAGIO.utils.logDebug = function() {
    if (window.ADAGIO.utils.isDebugEnabled()) {
        var args = Array.prototype.slice.call(arguments);
        window.ADAGIO.utils.log.apply(window, ["debug"].concat(args));
    }
};

/**
 * Log warning message
 * @param {...*} args - Warning arguments
 */
window.ADAGIO.utils.logWarning = function() {
    if (window.ADAGIO.utils.isDebugEnabled()) {
        var args = Array.prototype.slice.call(arguments);
        window.ADAGIO.utils.log.apply(window, ["warn"].concat(args));
    }
};

/**
 * Log error message
 * @param {...*} args - Error arguments
 */
window.ADAGIO.utils.logError = function() {
    if (window.ADAGIO.utils.isDebugEnabled()) {
        var args = Array.prototype.slice.call(arguments);
        window.ADAGIO.utils.log.apply(window, ["error"].concat(args));
    }
};

/**
 * Parse URI
 * @param {string} uri - URI to parse
 * @returns {Object|boolean} Parsed URI or false if invalid
 */
window.ADAGIO.utils.parseURI = function(uri) {
    if (typeof uri !== "string" || uri.slice(0, 4) !== "http") {
        window.ADAGIO.utils.logDebug("uriParser: unable to parse uri, invalid", uri);
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
};

/**
 * Get DOM Content Loaded time
 * @returns {number|null} Timestamp or null
 */
window.ADAGIO.utils.getDomContentLoadedTime = function() {
    var win = window.ADAGIO.utils.getTopWindow();
    var performance = win.performance || 
        win.msPerformance || 
        win.webkitPerformance || 
        win.mozPerformance;
        
    return performance && 
        performance.timing && 
        performance.timing.domContentLoadedEventStart > 0 
            ? performance.timing.domContentLoadedEventStart 
            : null;
};

/**
 * Get navigation start time
 * @returns {number|null} Navigation start time or null
 */
window.ADAGIO.utils.getNavigationStartTime = function() {
    var win = window.ADAGIO.utils.getTopWindow();
    var performance = win.performance || 
        win.msPerformance || 
        win.webkitPerformance || 
        win.mozPerformance;
        
    return performance && 
        performance.timing && 
        performance.timing.navigationStart > 0 
            ? performance.timing.navigationStart 
            : null;
};

/**
 * Detect device type
 * @returns {string} Device type: "desktop", "mobile", or "tablet"
 */
window.ADAGIO.utils.detectDeviceType = function() {
    var userAgent = window.ADAGIO.utils.getTopWindow().navigator.userAgent;
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
};

/**
 * Detect browser type
 * @returns {string} Browser type
 */
window.ADAGIO.utils.detectBrowser = function() {
    var win = window.ADAGIO.utils.getTopWindow();
    var userAgent = win.navigator.userAgent;
    var lowerUserAgent = userAgent.toLowerCase();
    
    if (/Edge\/\d./i.test(userAgent)) {
        return "edge";
    } else if (lowerUserAgent.indexOf("chrome") > 0) {
        return "chrome";
    } else if (lowerUserAgent.indexOf("firefox") > 0) {
        return "firefox";
    } else if (lowerUserAgent.indexOf("safari") > 0) {
        return "safari";
    } else if (lowerUserAgent.indexOf("opera") > 0) {
        return "opera";
    } else if (lowerUserAgent.indexOf("msie") > 0 || win.MSStream) {
        return "ie";
    } else {
        return "unknown";
    }
};

/**
 * Detect operating system
 * @returns {string} Operating system name
 */
window.ADAGIO.utils.detectOS = function() {
    var userAgent = window.ADAGIO.utils.getTopWindow().navigator.userAgent.toLowerCase();
    
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
};

// ========================================================================
// CONSTANTS & CONFIGURATION
// ========================================================================

/**
 * Standard IAB ad sizes
 * @type {Array<string>}
 */
window.ADAGIO.constants = {
    STANDARD_AD_SIZES: [
        "120x600", "160x600", "300x250", "300x600", "300x1050", 
        "600x250", "600x600", "728x90", "728x94", "728x315", 
        "800x600", "970x90", "970x250", "1000x200"
    ],
    
    /**
     * Element without IAB dimensions
     * @type {number}
     */
    REASON_NOT_MEASURABLE_NO_IAB_DIMS: 0,
    
    /**
     * Element with IAB dimensions
     * @type {number}
     */
    REASON_NOT_MEASURABLE_HAS_IAB_DIMS: 1,
    
    /**
     * Endpoints for beacon collection
     * @type {Object}
     */
    ENDPOINTS: {
        avw: "//c.4dex.tech/avw.gif"
    },
    
    /**
     * Blacklisted organization IDs
     * @type {Array}
     */
    BLACKLISTED_ORG_IDS: []
};

// Helper functions for storage manager

/**
 * Check if path exists in object
 * @param {Object} obj - The object to check
 * @param {string} path - The path to check
 * @returns {boolean} Whether path exists
 */
window.ADAGIO.utils.hasPathInObject = function(obj, path) {
    if (!obj || !path) return false;
    
    var parts = path.split('.');
    var current = obj;
    
    for (var i = 0; i < parts.length; i++) {
        if (!current || typeof current !== 'object') {
            return false;
        }
        
        if (!Object.prototype.hasOwnProperty.call(current, parts[i])) {
            return false;
        }
        
        current = current[parts[i]];
    }
    
    return true;
};

/**
 * Get value at path in object
 * @param {Object} obj - The object to get from
 * @param {string} path - The path to the value
 * @returns {*} The value at path
 */
window.ADAGIO.utils.getValueAtPath = function(obj, path) {
    if (!obj || !path) return null;
    
    var parts = path.split('.');
    var current = obj;
    
    for (var i = 0; i < parts.length; i++) {
        if (!current || typeof current !== 'object') {
            return null;
        }
        
        current = current[parts[i]];
    }
    
    return current;
};

/**
 * Set value at path in object
 * @param {Object} obj - The object to set in
 * @param {string} path - The path to set
 * @param {*} value - The value to set
 */
window.ADAGIO.utils.setValueAtPath = function(obj, path, value) {
    if (!obj || !path) return;
    
    var parts = path.split('.');
    var current = obj;
    
    for (var i = 0; i < parts.length - 1; i++) {
        if (!current[parts[i]]) {
            current[parts[i]] = {};
        }
        
        current = current[parts[i]];
    }
    
    current[parts[parts.length - 1]] = value;
};

/**
 * Unset path in object
 * @param {Object} obj - The object to unset in
 * @param {string} path - The path to unset
 */
window.ADAGIO.utils.unsetPathInObject = function(obj, path) {
    if (!obj || !path) return;
    
    var parts = path.split('.');
    var current = obj;
    
    for (var i = 0; i < parts.length - 1; i++) {
        if (!current || typeof current !== 'object') {
            return;
        }
        
        current = current[parts[i]];
    }
    
    if (current && typeof current === 'object') {
        delete current[parts[parts.length - 1]];
    }
};

/**
 * Storage Manager - Wrapper around localStorage
 * @class StorageManager
 */
window.ADAGIO.classes.StorageManager = window.ADAGIO.utils.createClass(function StorageManager() {
    window.ADAGIO.utils.assertInstance(this, window.ADAGIO.classes.StorageManager);
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
            
            return window.ADAGIO.utils.hasPathInObject(data, path) 
                ? window.ADAGIO.utils.getValueAtPath(data, path) 
                : null;
        }
    },
    {
        key: "store",
        value: function store(path, value) {
            this.insureSchema();
            
            var data = JSON.parse(this.w.localStorage.getItem("adagio"));
            window.ADAGIO.utils.setValueAtPath(data, path, value);
            this.w.localStorage.setItem("adagio", JSON.stringify(data));
        }
    },
    {
        key: "unset",
        value: function unset(path) {
            var data = JSON.parse(this.w.localStorage.getItem("adagio"));
            window.ADAGIO.utils.unsetPathInObject(data, path);
            this.w.localStorage.setItem("adagio", JSON.stringify(data));
        }
    }
]);

// Initialize storage for version tracking
window.ADAGIO.utils.logDebug("Core module initialized");
