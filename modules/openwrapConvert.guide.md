# `modules/openwrapConvert.js` – Implementation Guide

This document explains **every major behavior implemented in** `modules/openwrapConvert.js`, with a focus on the entrypoint **`window.PWT.requestConvertServer`** and the *Dynamic Consent Management Handler* embedded in this module.

It also covers `modules/owGeoDetection.js` because `openwrapConvert.js` relies on `getGlobal().detectLocation`, `getGlobal().getDataFromLocalStorage`, and `getGlobal().setAndStringifyToLocalStorage`, which are implemented there.

---

## 1. What this module does (high-level)

`openwrapConvert.js` provides three major capabilities:

- **1) Rendering helpers**
  - `window.PWT.renderAllAdUnits()`
  - `window.PWT.renderOne(winningBid)`

- **2) S2S request bootstrapper (entrypoint)**
  - `window.PWT.requestConvertServer(obj)`
  - Sets up Prebid Server (S2S) config and adUnits based on a provided config object.

- **3) Dynamic Consent Management Handler (in-file orchestration)**
  - Detects CMPs (GDPR/USP/GPP) if present.
  - Fetches geo information in parallel.
  - Chooses **consent basis**:
    - CMP-based (preferred if CMP appears before timeout)
    - Geo-based fallback (if CMP does not appear within timeout)
    - None (if neither CMP nor geo compliance info is available)
  - Produces a Prebid `consentManagement` configuration object and returns it to the caller.

---

## 2. External / runtime dependencies

This module assumes the following are available at runtime:

- **`pbjs`**: global Prebid.js object (used by `pbjs.getHighestCpmBids()` and `pbjs.renderAd()`).
- **`window.PWT`**: global namespace used by OpenWrap integration. The module ensures it exists (`window.PWT = window.PWT || {}`).
- **Prebid core APIs**
  - `getGlobal()` from `../src/prebidGlobal` (referred to as the “OpenWrap namespace” in this document)
  - `owNamespace.setConfig(...)` and `owNamespace.addAdUnits(...)`
- **Utility functions** from `../src/utils`
  - `logWarn`, `logInfo`, `isNumber`, `isFunction`, `isEmpty`
- **Geo helpers** (injected into `getGlobal()` by `modules/owGeoDetection.js`)
  - `getGlobal().detectLocation(url, cb)`
  - `getGlobal().getDataFromLocalStorage(key, expiryMs)`
  - `getGlobal().setAndStringifyToLocalStorage(key, object)`

Important: `openwrapConvert.js` calls `getGlobal().detectLocation(...)` and `getGlobal().getDataFromLocalStorage(...)`. These functions are **not defined in `openwrapConvert.js`**; they are defined in `owGeoDetection.js`.

---

## 3. Public APIs exported via `window.PWT`

### 3.1 `window.PWT.renderAllAdUnits()`

- **Purpose**: Render all highest-CPM winning bids returned by Prebid.
- **Flow**:
  - Calls `pbjs.getHighestCpmBids()`.
  - For each winning bid, calls `window.PWT.renderOne(winners[i])`.

**Key assumption**: `pbjs.getHighestCpmBids()` returns bids with at least:
- `adUnitCode`
- `adId`

### 3.2 `window.PWT.renderOne(winningBid)`

- **Purpose**: Render a single bid’s creative into an iframe under an element whose id equals the `adUnitCode`.
- **Input**: `winningBid` (expects at least `winningBid.adId` and `winningBid.adUnitCode`).

**What it does (step-by-step):**

- Validates `winningBid && winningBid.adId`.
- Locates the container element:
  - `div = document.getElementById(winningBid.adUnitCode)`
- Removes any existing iframe with id:
  - `prebid_ads_iframe_${winningBid.adUnitCode}`
- Creates a new iframe and configures:
  - `scrolling='no'`, `frameBorder='0'`, margins, and `sandbox` attributes.
  - `name`, `id`, `title`, `aria-label`, style border/margin/overflow.
- Appends iframe to the container.
- Gets iframe document via `iframe.contentWindow.document`.
- Calls `pbjs.renderAd(iframeDoc, winningBid.adId)` to inject creative.
- Injects **normalize.css** into iframe head to normalize styling.

**Operational notes / gotchas:**

- The iframe’s `sandbox` is explicitly configured to allow scripts/popups/same-origin etc.
- Existing iframe is removed to avoid duplicate iframes in the slot.
- Rendering depends entirely on Prebid’s `renderAd` behavior.

---

## 4. Main entrypoint: `window.PWT.requestConvertServer(obj)`

This is the function new integrators will most likely call.

### 4.1 Purpose

- Sets the publisher id on `window.PWT.publisherId`.
- Resolves consent management configuration dynamically.
- Applies `consentManagement` config (if available) to the Prebid instance.
- Configures `s2sConfig` (Prebid Server) and registers adUnits.

### 4.2 Input config object (`obj`) – full reference

The following fields are used:

#### Mandatory

- **`publisherId`** (string)
  - Required; function exits early if missing.
  - Warning message indicates it “cannot be numeric” (practically: pass a string, e.g. `'1234'`).

#### Optional / recommended for S2S

- **`accountId`** (string)
  - Used for `s2sConfig.accountId`.

- **`bidders`** (array of strings)
  - Defaults to `['pubmatic']`.

- **`timeout`** (number)
  - Defaults to `1000` ms.

- **`adapter`** (string)
  - Defaults to `'prebidServer'`.

- **`endpoint`** (string URL)
  - Defaults to `https://prebid-server.pubmatic.com/prebidserver/auction`.

- **`adUnits`** (array)
  - Passed to `owNamespace.addAdUnits(obj.adUnits)`.

#### Optional wrapper metadata (PubMatic ext)

- **`keywords`**
  - Used inside default `extPrebid.bidderparams.pubmatic.wrapper.keywords`.

- **`profileid`**
  - Used inside default `extPrebid.bidderparams.pubmatic.wrapper.profileid`.

- **`versionid`**
  - Used inside default `extPrebid.bidderparams.pubmatic.wrapper.versionid`.

#### Optional override

- **`extPrebid`** (object)
  - If provided, it fully replaces the internally built default ext.
  - If not provided, code builds a default ext shaped like:

```js
{
  bidderparams: {
    pubmatic: {
      publisherId: obj.publisherId,
      wrapper: {
        profileid: obj.profileid || null,
        versionid: obj.versionid || null,
        keywords: obj.keywords || null
      }
    }
  }
}
```

### 4.3 What `requestConvertServer` does (detailed step-by-step)

1. Gets Prebid “global” namespace
   - `var owNamespace = getGlobal();`

2. Validates `obj.publisherId`
   - If missing, logs:
     - `OpenWrapConvert: Error: publisherId is mandatory and cannot be numeric ...`
   - Returns early.

3. Sets global publisher id
   - `window.PWT.publisherId = obj.publisherId;`
   - This is important because the geo URL uses it:
     - `https://ut.pubmatic.com/geo?pubid=<publisherId>`

4. Starts CMP timing metric
   - `timeMetrics.recordEntryTime("CMP_CALLING_TIME");`

5. Calls consent resolver
   - `ConsentResolver.getConsentManagementConfig(function(cmConfig) { ... })`

6. If consent config is returned and non-empty
   - Calls:

```js
owNamespace.setConfig({
  consentManagement: cmConfig
});
```

7. Builds `extPrebid`
   - Uses `obj.extPrebid` if provided, otherwise uses the default structure.

8. Applies `s2sConfig`

```js
owNamespace.setConfig({
  s2sConfig: {
    accountId: obj.accountId || '',
    enabled: true,
    allowUnknownBidderCodes: true,
    bidders: obj.bidders || ['pubmatic'],
    timeout: obj.timeout || 1000,
    adapter: obj.adapter || 'prebidServer',
    endpoint: obj.endpoint || 'https://prebid-server.pubmatic.com/prebidserver/auction',
    extPrebid: extPrebid
  }
});
```

9. Registers ad units
   - `owNamespace.addAdUnits(obj.adUnits);`

**Important ordering:** consent config resolution happens *before* the `s2sConfig` and adUnits setup inside the callback.

---

## 5. High-level flow diagram (entrypoint + consent resolution)

```mermaid
flowchart TD
  A[window.PWT.requestConvertServer(obj)] --> B{publisherId present?}
  B -- no --> B1[logWarn + return]
  B -- yes --> C[window.PWT.publisherId = obj.publisherId]
  C --> D[timeMetrics.recordEntryTime(CMP_CALLING_TIME)]
  D --> E[ConsentResolver.getConsentManagementConfig(cb)]

  E --> F[GeoService.getGeoInfoWrapper()
(fetch geo in parallel)]
  E --> G[checkCmpRecursively()
(poll for CMP every 50ms)]
  E --> H[setTimeout(fallback, cmpLookUpTimeout)]

  G --> I{CMP detected before timeout?}
  I -- yes --> J[Configure CMP-based prebid CM config
(GDPR/USP/GPP)]
  J --> K[cb(cmConfig) + mark processComplete]

  I -- no --> L[Fallback: use geo compliance from window.PWT.CC.gc]
  L --> M{geo compliance available?}
  M -- no --> N[cb({}) or NONE basis]
  M -- yes --> O[Prepare CM config for geo compliance]
  O --> K

  K --> P[if cmConfig not empty: owNamespace.setConfig({consentManagement: cmConfig})]
  P --> Q[owNamespace.setConfig({s2sConfig: ...})]
  Q --> R[owNamespace.addAdUnits(obj.adUnits)]
```

---

## 6. Dynamic Consent Management Handler (detailed)

This logic starts after the comment:
- `// Dynamic Consent Management Handler logic - START`

It is written as a set of IIFEs (“modules”) with shared state stored in `ConsentConfigManager` (`crConfig`).

### 6.1 `ConsentConstants`

Central constants for:

- **CMP lookup & continuous checking**
  - `DEFAULT_CMP_LOOK_UP_TIMEOUT = 1000`
  - `CONTINUOUS_CMP_CHECK_TIMEOUT = 15000` (used only in the disabled continuous-check module)

- **Source selection**
  - `CONSENT_MANAGEMENT_SOURCE`: `{ CMP: 1, GEO: 2, NONE: 0 }`

- **Compliance map**
  - `COMPLIANCE_MAP`: `{ GDPR: 1, USP: 2, GPP: 3 }`

- **Geo source selection**
  - `READ_GEO_DATA_FROM`: `{ LOCALSTORAGE: 1, GEO_SERVICE: 2, NONE: 0 }`

### 6.2 `ConsentConfigManager` (singleton)

Provides a singleton config/state object accessed as `crConfig`.

**Key internal state it tracks:**

- `consentManagementEnabled`
- `processCompleted`
- `cmpPresent`
- `complianceSupport` (array of numeric codes: 1/2/3)
- `cmpId`
- `enforcedConsentBasisOn` (CMP/GEO/NONE)
- `readGeoDataFrom` (LOCALSTORAGE/GEO_SERVICE/NONE)
- `geoInfo`:
  - `cc` country code
  - `sc` state code
  - `gc` regulation to apply (1/2/3)
  - `gsId` gpp section id
- `geoMatchWithCMP` (0/1/2)
- `prebidCMConfig` (object with keys like `gdpr`, `usp`, `gpp`)
- `callbackFunctions` queue

**Notable behaviors:**

- `getProcessCompleted(callbackFn)`
  - If already completed, calls callback immediately.
  - Else queues it.

- `setProcessCompleted(true)` triggers execution of queued callbacks.

- `setGeoInfo(readFrom, geoInfo)`
  - Stores geo info and calls `setGeoMatchWithCMP()`.

- `getProperties()`
  - Exposes a compact object used by:
    - `window.PWT.getConsentResolverConfig()`

### 6.3 `ComplianceApiConfig`

Defines which CMP APIs are detectable:

- GDPR: `__tcfapi`
- USP: `__uspapi`
- GPP: `__gpp`

Each entry stores:
- `apiName`
- `complianceName` (string used as key for prebid CM config)
- `prepareConfig` (handler function; set later)

### 6.4 `ComplianceHandler`

Defines the `prepareConfig` functions used to produce Prebid consentManagement config.

- `configureGDPR()` builds a `gdprConfig`:
  - `cmpApi: "iab"`
  - `timeout: 5000`
  - `defaultGdprScope: true`
  - optionally `actionTimeout` from `window.PWT.actionTimeout` if numeric

- `configureUSP()` builds `uspConfig`:
  - `cmpApi: "iab"`
  - `timeout: 1000`

- `configureGPP()` builds `gppConfig`:
  - `cmpApi: "iab"`
  - `timeout: 2000`

Each handler stores config via:
- `crConfig.setPrebidCMConfig("gdpr" | "usp" | "gpp", conf)`

### 6.5 `GeoService`

- `getGeoInfoWrapper()` does:
  - `timeMetrics.recordEntryTime("GEO_CALLING_TIME", 1500)`
    - Note: it provides a default duration of 1500ms in case the service never responds.
  - Calls `commonUtil.getGeoInfo(ConsentConstants.READ_GEO_DATA_FROM, cb)`
  - Callback stores geo info via `crConfig.setGeoInfo(readFrom, geoInfo)`
  - Calls `timeMetrics.recordExitTime("GEO_CALLING_TIME")`

### 6.6 `CmpDetector`

Discovers CMP APIs by walking up frame parents.

- `checkCMPInWindow(frame)`:
  - Looks for `frame["__tcfapi"]`, `frame["__uspapi"]`, `frame["__gpp"]`.
  - If a function is present, records it as a detected CMP.

- `getCMPsPresentOnPage()`:
  - Iterates `currentWindow = window; while (currentWindow)`
  - Adds CMPs detected in each frame.
  - Stops when reaching `window.top`.

### 6.7 `ConsentResolver` (main orchestrator)

This is what `requestConvertServer()` calls.

#### 6.7.1 Timing helpers

- `setCMPTime(timeExceeded)`
  - Ensures CMP timing is recorded at least once.

- `getCMPLookUpTimeout()`
  - Uses `window.PWT.cmpLookUpTimeout` (if numeric) else defaults to `1000`.

#### 6.7.2 CMP-specific ping handlers

- `handleGDPR(pingReturnData, success)`
  - If successful and has `cmpId`, stores `crConfig.setCmpId(...)`.

- `handleGPP(pingReturnData, success)`
  - Stores cmpId from `pingReturnData.pingData.cmpId`.

#### 6.7.3 CMP config application

- `setConsentResolverConfig(detectedCmps)`
  - For each detected CMP:
    - records timing
    - adds compliance support numeric code
    - sets `cmpPresent=true`
    - attaches event listeners to capture CMP id:
      - GDPR: `__tcfapi('addEventListener', 2, handleGDPR)`
      - GPP: `__gpp('addEventListener', handleGPP)`

#### 6.7.4 Main function: `getConsentManagementConfig(callbackToSetConfig)`

This function determines which consent basis is used:

- Always starts `CONSENT_CONFIG_RESOLVER_TIME` metric.
- Enables consent management flag.
- Starts geo fetch (`GeoService.getGeoInfoWrapper()`)
- Starts CMP detection loop (polls every 50ms)
- Arms timeout (`cmpLookUpTimeout`) to trigger fallback.

**CMP path (preferred):**

- If CMP is detected before timeout:
  - runs `setConsentResolverConfig(detectedCmps)`
  - runs each CMP’s `prepareConfig()` (GDPR/USP/GPP) to populate `crConfig.prebidCMConfig`
  - sets geo match state `crConfig.setGeoMatchWithCMP()`
  - executes callback with CM config and marks basis as CMP

**Fallback path (geo-based):**

- If CMP not detected within timeout:
  - checks if `window.PWT.CC.gc` exists (geo compliance info)
  - if missing: executes callback with NONE
  - else maps `gc` numeric code to compliance name using `getKeyByValue(COMPLIANCE_MAP, gc)`
  - calls the relevant `prepareConfig()` and executes callback with GEO basis

#### 6.7.5 Observable outputs

- Callback receives: `crConfig.getPrebidCMConfig()` (object keyed by `gdpr`/`usp`/`gpp`).
- Also sets `crConfig.enforcedConsentBasisOn` and `processCompleted`.

---

## 7. Helper modules inside `openwrapConvert.js`

### 7.1 `commonUtil`

#### 7.1.1 `getGeoInfo(readFromEnum, callback)`

- Uses key prefix: `PREFIX = 'UINFO'`
- Validity: `LOCATION_INFO_VALIDITY = 172800000` (2 days)

**Flow:**

1. Builds geo detection URL:
   - `https://ut.pubmatic.com/geo?pubid=${window.PWT.publisherId}`

2. Attempts to read cached geo:
   - `info = getGlobal().getDataFromLocalStorage(PREFIX, LOCATION_INFO_VALIDITY)`

3. If cache exists and contains `cc`:
   - `window.PWT.CC = JSON.parse(info)`
   - `callback(LOCALSTORAGE, window.PWT.CC)`

4. Else fetches geo:
   - `getGlobal().detectLocation(geoDetectionURL, function(loc, success) { ... })`
   - On success:
     - `callback(GEO_SERVICE, loc)`
     - `getGlobal().setAndStringifyToLocalStorage(PREFIX, loc)`
     - `window.PWT.CC = loc`

#### 7.1.2 `getGlobalOwObject()`

- Ensures `window.PWT` exists and returns it.

#### 7.1.3 `getKeyByValue(obj, value)`

- Linear search to find key for matching value.
- Used to map numeric compliance code to name (`1 -> 'GDPR'`, etc).

### 7.2 `timeMetrics`

Provides lightweight performance/timing metrics stored in an internal `metrics` object.

- Metrics structure per key:
  - `st` start time
  - `et` end time
  - `tt` total time

Public functions:

- `recordEntryTime(keyName | keyName[], defaultTotalTime?)`
- `recordExitTime(keyName | keyName[], defaultTotalTime?)`
- `getDurationOf(keyName)`

Also exports:

- `window.PWT.getMetrics()` returns the metrics object

### 7.3 Exposed debug function

- `window.PWT.getConsentResolverConfig()`
  - Returns `crConfig.getProperties()` (compact state snapshot)

---

## 8. How `modules/owGeoDetection.js` is used here

`openwrapConvert.js` assumes `getGlobal()` has geo + storage helper methods.

`modules/owGeoDetection.js` provides these by attaching methods onto the Prebid global:

- `getGlobal().detectLocation(URL, passBack)`
  - Makes a GET request using Prebid’s `ajaxBuilder()`.
  - Parses response as JSON.
  - Calls `passBack(locationObj, true)` on success.
  - Calls `passBack({error}, false)` on error.

- `getGlobal().getDataFromLocalStorage(key, expiryMs)`
  - Uses Prebid’s `getStorageManager({ bidderCode: 'pubmatic' })`.
  - Reads and validates `createdDate` in stored object.
  - Removes expired entries.

- `getGlobal().setAndStringifyToLocalStorage(key, object)`
  - Adds `createdDate`.
  - Persists JSON string.

This means:

- `openwrapConvert.js` does **not** directly depend on browser `localStorage`.
- It relies on Prebid’s storage abstraction for privacy and bidder-scoped storage policies.

---

## 9. Configuration knobs and observable globals

### 9.1 `window.PWT` globals used/produced

- **`window.PWT.publisherId`**
  - Set by `requestConvertServer`.
  - Used to build geo lookup URL.

- **`window.PWT.CC`**
  - Set by geo logic (`commonUtil.getGeoInfo`).
  - Expected shape includes `gc` (regulation numeric code) and `cc` (country code).

- **`window.PWT.cmpLookUpTimeout`** (optional)
  - If numeric, overrides CMP lookup timeout.

- **`window.PWT.actionTimeout`** (optional)
  - If numeric, used as GDPR config `actionTimeout`.

- **`window.PWT.getMetrics()`**
  - Returns internal metrics.

- **`window.PWT.getConsentResolverConfig()`**
  - Returns a compact snapshot of consent resolver state.

### 9.2 Consent config object returned to `requestConvertServer`

The consent resolver returns something like:

- `{ gdpr: { ... } }` when GDPR is applicable
- `{ usp: { ... } }` when USP is applicable
- `{ gpp: { ... } }` when GPP is applicable

Each key contains:
- `cmpApi: "iab"`
- `timeout: <number>`
- optionally other fields (GDPR: `defaultGdprScope`, `actionTimeout`)

---

## 10. Common integration example

```js
window.PWT.requestConvertServer({
  publisherId: '12345',
  accountId: 'your-account',
  bidders: ['pubmatic'],
  timeout: 1200,
  endpoint: 'https://prebid-server.pubmatic.com/prebidserver/auction',
  keywords: { test: ['a', 'b'] },
  profileid: 'p1',
  versionid: 'v1',
  adUnits: [/* standard Prebid adUnits */]
});
```

---

## 11. Troubleshooting checklist

- **No bids / consent not applied**
  - Check `window.PWT.getConsentResolverConfig()`:
    - Is `ccmp` (CMP present) 1?
    - Is `ccme` (consent enabled) 1?
    - What is `cecbo` (basis: CMP/GEO/NONE)?

- **Geo fallback not working**
  - Verify `window.PWT.publisherId` is set before geo fetch.
  - Verify `window.PWT.CC` exists and includes `gc`.

- **CMP not detected**
  - Ensure CMP APIs exist in top/parent frames:
    - `__tcfapi`, `__uspapi`, `__gpp`
  - Increase `window.PWT.cmpLookUpTimeout` if CMP loads late.

- **LocalStorage cache not used**
  - Confirm `modules/owGeoDetection.js` is included in the build.
  - Confirm storage permissions allow PubMatic bidder storage.

---

## 12. Notes on disabled continuous CMP check

At the end of the file there is a commented-out “Continuous CMP check” module.

- It is currently **not active**.
- If enabled, it would attempt to keep checking for CMP presence for a window of time and switch consent basis when CMP appears.

---

## 13. Summary

- `requestConvertServer` is the main entrypoint.
- It dynamically determines consent config by preferring CMP detection, falling back to geo compliance.
- Geo detection relies on helper methods implemented in `owGeoDetection.js`.
- S2S setup (`s2sConfig`) and adUnits registration happens after consent resolution completes.
