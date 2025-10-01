# ADAGIO JavaScript Library - Unminified & Refactored

This directory contains a refactored and unminified version of the ADAGIO ad measurement library (version 2.1.11) that was previously minified. The code has been restructured into multiple files with improved variable names, documentation, and organization.

## File Structure

The library has been split into the following files:

1. **`adagio_core.js`** - Core utility functions and global namespace
2. **`adagio_session.js`** - Session and navigation management
3. **`adagio_measurement.js`** - Viewability measurement functionality
4. **`adagio_features.js`** - Browser and device features detection
5. **`adagio_main.js`** - Main entry point and integration

## Library Overview

ADAGIO is an ad viewability measurement and integration library that works with multiple ad servers (GPT/DFP, Smart Ad Server, AppNexus). Its primary functions include:

- Measuring ad viewability (when ads are visible on screen)
- Tracking view time and user engagement
- Sending measurement beacons to collection servers
- Integrating with various ad server events
- Supporting ad refresh based on viewability

## Key Components

### Storage Manager
Handles persistent storage via localStorage with error recovery and schema migration.

### Session Manager
Tracks user sessions, handles timeouts, and manages sampling rates.

### Navigation Manager
Tracks page navigation, referrers, and session metrics.

### ViewabilityMeasurer
Core measurement component that tracks when ads are visible on screen.

### Features Manager
Detects browser, device, and environment features.

## Using the Refactored Library

To use the refactored library, include the JavaScript files in the following order:

```html
<script src="adagio_unminified.js"></script>
<script src="adagio_session.js"></script>
<script src="adagio_features.js"></script>
<script src="adagio_measurement.js"></script>
<script src="adagio_main.js"></script>
```

Alternatively, you can continue using the original minified version:

```html
<script src="minified.js"></script>
```

## Configuration

The ADAGIO library automatically integrates with supported ad servers and begins tracking when ads are rendered. For debugging, you can enable verbose logging by adding this to localStorage:

```javascript
localStorage.setItem('ADAGIO_DEV_DEBUG', true);
```

## Improvements in the Refactored Version

1. **Descriptive Variable Names**: Single-letter variables replaced with meaningful names
2. **Structured Documentation**: JSDoc comments explaining function purposes
3. **Modular Organization**: Code split into logical components
4. **Clearer Class Structure**: Object-oriented design with well-defined methods
5. **Enhanced Readability**: Improved formatting and structure

## Original Functionality Maintained

The refactored version maintains all functionality from the original minified code, including:

- Ad server integrations (DFP/GPT, SAS, AST)
- Viewability measurement
- Session tracking
- Beacon sending
- Feature detection

## Note About Integration

This refactored version is provided for code readability and maintenance. For production use, the original minified version may be more efficient in terms of file size and loading performance.
