var pbjs = pbjs || {};
pbjs.que = pbjs.que || [];
pbjs.que.push(function() {
    function postPubmaticRequestBidsHook(next, reqBidsConfigObj) {
        console.log('Azzi123 >> Post Floor Hook executed');
        pbjs.mergeConfig({
            floors:{
                additionalSchemaFields:{
                    supportScreen: function() {
                        // Determine screen support level based on viewport width
                        const width = window.innerWidth;
                        return width > 1200 ? 'large' : width > 768 ? 'medium' : 'small';
                      }
                }
            }
        })
        // Always continue the auction process 
        return next(reqBidsConfigObj);
      }

      function prePubmaticRequestBidsHook(next, reqBidsConfigObj) {
        console.log('Azzi123 >>Pre Floor Hook executed');
        // Always continue the auction process
        return next(reqBidsConfigObj);
      }
    pbjs.requestBids.before(prePubmaticRequestBidsHook, 100);
    pbjs.requestBids.before(postPubmaticRequestBidsHook, 10);
});

window.PWT = window.PWT || {}
window.PWT.postPubmaticRequestBidsHook = function(){
    console.log('Azzi123 >> Post Floor Hook executed with ns PWT');
    // Always continue the auction process
    return next(reqBidsConfigObj);
}

window.PWT.prePubmaticRequestBidsHook = function(){
    console.log('Azzi123 >> Pre Floor Hook executed with ns PWT');
    // Always continue the auction process
    return next(reqBidsConfigObj);
}
    
