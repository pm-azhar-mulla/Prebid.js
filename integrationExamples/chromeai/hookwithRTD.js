// var pbjs = pbjs || {};
// pbjs.que = pbjs.que || [];
// pbjs.que.push(function() {

    function postPubmaticRequestBidsHook(next, reqBidsConfigObj) {
        console.log('Azzi1234 >> Post Floor Hook executed', reqBidsConfigObj);
        
        var prevConfig = pbjs.getConfig('floors');
        //console.log("pbjs getConfig", prevConfig.additionalSchemaFields.supportScreen);
        if(prevConfig && prevConfig.additionalSchemaFields && !prevConfig.additionalSchemaFields.supportScreen){
            
            pbjs.mergeConfig({
                floors:{
                    additionalSchemaFields:{
                        supportScreen: function() {
                            // Determine screen support level based on viewport width
                            const width = window.innerWidth;
                            console.log("WWWWWWW", width);
                            return width > 1200 ? 'large' : width > 768 ? 'medium' : 'small';
                          }
                    }
                }
            });    
        }
        // Always continue the auction process 
        return next(reqBidsConfigObj);
      }

      function prePubmaticRequestBidsHook(next, reqBidsConfigObj) {
        console.log('Azzi123 >>Pre Floor Hook executed');
        // Always continue the auction process
        return next(reqBidsConfigObj);
      }
      (function(){
        function getNamespace() {
            // Get the current script URL
            let scriptUrl = '';
            // Find the current script element
            const scripts = document.getElementsByTagName('script');
            const currentScript = document.currentScript; // modern browsers
            
            if (currentScript) {
              scriptUrl = currentScript.src;
            } else {
              // Fallback for older browsers: find the last script loaded
              // This is not perfect but works in most cases
              const lastScript = scripts[scripts.length - 1];
              scriptUrl = lastScript.src;
            }
            
            try {
              // Parse the URL to extract parameters
              const url = new URL(scriptUrl);
              return url.searchParams.get('ns') || 'pbjs';
            } catch (e) {
              // Fallback if URL parsing fails
              const match = scriptUrl.match(/[?&]ns=([^&#]*)/i);
              return match ? match[1] : 'pbjs';
            }
          }
          
        // Store the namespace - this will be used throughout the code
        const NAMESPACE = getNamespace();
        console.log("Azzi123 >> Namespace=", NAMESPACE);
        pbjs.requestBids.before(prePubmaticRequestBidsHook, 100);
        pbjs.requestBids.before(postPubmaticRequestBidsHook, 10);
    
        pbjs.onEvent('beforeRequestBids', function(auction) {
            
            //auction.adUnits[0].adserverTargeting = {"abc":"def"};
        });

        // pbjs.mergeConfig({
        //     floors:{
        //         additionalSchemaFields:{
        //             supportScreen: function() {
        //                 // Determine screen support level based on viewport width
        //                 const width = window.innerWidth;
        //                 console.log("WWWWWWW", width);
        //                 return width > 1200 ? 'large' : width > 768 ? 'medium' : 'small';
        //               }
        //         }
        //     }
        // });
    })();
    

    //setTimeout(() => {
        
    //}, 100);
// });

// window.PWT = window.PWT || {}
// window.PWT.postPubmaticRequestBidsHook = function(){
//     console.log('Azzi123 >> Post Floor Hook executed with ns PWT');
//     // Always continue the auction process
//     return next(reqBidsConfigObj);
// }

// window.PWT.prePubmaticRequestBidsHook = function(){
//     console.log('Azzi123 >> Pre Floor Hook executed with ns PWT');
//     // Always continue the auction process
//     return next(reqBidsConfigObj);
// }
    
