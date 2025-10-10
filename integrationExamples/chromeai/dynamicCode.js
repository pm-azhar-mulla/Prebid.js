// pubmatic-rtd-extension.js
(function() {
    // Initialize the extension namespace
    window.PubmaticRtdExtensions = window.PubmaticRtdExtensions || {};
  
    // Define the additionalSchemaFields object with custom field handlers
    window.PubmaticRtdExtensions.additionalSchemaFields = {
      // Example custom field: supportScreen
      supportScreen: function() {
        // Determine screen support level based on viewport width
        const width = window.innerWidth;
        return width > 1200 ? 'large' : width > 768 ? 'medium' : 'small';
      },
      
      // Example custom field: contentType
      contentType: function() {
        // Get content type from meta tags
        const metaContent = document.querySelector('meta[name="content-type"]');
        return metaContent ? metaContent.getAttribute('content') : 'general';
      },
      
      // Example custom field: pageSection
      pageSection: function() {
        // Determine page section from URL path
        const path = window.location.pathname;
        if (path.includes('/news/')) return 'news';
        if (path.includes('/sports/')) return 'sports';
        if (path.includes('/entertainment/')) return 'entertainment';
        return 'other';
      }
    };
  
    // Helper function to add additional schema fields dynamically
    window.PubmaticRtdExtensions.addSchemaField = function(name, handlerFn) {
      if (typeof handlerFn !== 'function') {
        console.error(`Handler for schema field '${name}' must be a function`);
        return;
      }
      
      window.PubmaticRtdExtensions.additionalSchemaFields[name] = handlerFn;
      console.log(`Added new schema field: ${name}`);
    };
    
    // Helper function to remove a schema field
    window.PubmaticRtdExtensions.removeSchemaField = function(name) {
      if (window.PubmaticRtdExtensions.additionalSchemaFields[name]) {
        delete window.PubmaticRtdExtensions.additionalSchemaFields[name];
        console.log(`Removed schema field: ${name}`);
        return true;
      }
      return false;
    };
  
    console.log('PubmaticRtdExtensions initialized with fields:', 
      Object.keys(window.PubmaticRtdExtensions.additionalSchemaFields).join(', '));
  })();