import { getGlobal } from "../src/prebidGlobal";
import { logWarn } from "../src/utils";

const LOG_WARN_PREFIX = 'OpenWrapConvert: ';
window.PWT = window.PWT || {};
window.PWT.renderAllAdUnits = function() {
    var winners=pbjs.getHighestCpmBids();
    for (var i = 0; i < winners.length; i++) {
        window.PWT.renderOne(winners[i]);
    }
}

window.PWT.renderOne = function(winningBid) {
if (winningBid && winningBid.adId) {
    var div = document.getElementById(winningBid.adUnitCode);
    if (div) {
				var oldIframe = document.getElementById("prebid_ads_iframe_" + winningBid.adUnitCode);
				if(oldIframe){
					oldIframe.remove();
				}
        const iframe = document.createElement('iframe');
        iframe.scrolling = 'no';
        iframe.frameBorder = '0';
        iframe.marginHeight = '0';
        iframe.marginHeight = '0';
        iframe.name = `prebid_ads_iframe_${winningBid.adUnitCode}`;
				iframe.id = `prebid_ads_iframe_${winningBid.adUnitCode}`;
        iframe.title = '3rd party ad content';
        iframe.sandbox.add(
            'allow-forms',
            'allow-popups',
            'allow-popups-to-escape-sandbox',
            'allow-same-origin',
            'allow-scripts',
            'allow-top-navigation-by-user-activation'
        );
        iframe.setAttribute('aria-label', 'Advertisment');
        iframe.style.setProperty('border', '0');
        iframe.style.setProperty('margin', '0');
        iframe.style.setProperty('overflow', 'hidden');
        div.appendChild(iframe);
        const iframeDoc = iframe.contentWindow.document;
        pbjs.renderAd(iframeDoc, winningBid.adId);
        const normalizeCss = `/*! normalize.css v8.0.1 | MIT License | github.com/necolas/normalize.css */button,hr,input{overflow:visible}progress,sub,sup{vertical-align:baseline}[type=checkbox],[type=radio],legend{box-sizing:border-box;padding:0}html{line-height:1.15;-webkit-text-size-adjust:100%}body{margin:0}details,main{display:block}h1{font-size:2em;margin:.67em 0}hr{box-sizing:content-box;height:0}code,kbd,pre,samp{font-family:monospace,monospace;font-size:1em}a{background-color:transparent}abbr[title]{border-bottom:none;text-decoration:underline;text-decoration:underline dotted}b,strong{font-weight:bolder}small{font-size:80%}sub,sup{font-size:75%;line-height:0;position:relative}sub{bottom:-.25em}sup{top:-.5em}img{border-style:none}button,input,optgroup,select,textarea{font-family:inherit;font-size:100%;line-height:1.15;margin:0}button,select{text-transform:none}[type=button],[type=reset],[type=submit],button{-webkit-appearance:button}[type=button]::-moz-focus-inner,[type=reset]::-moz-focus-inner,[type=submit]::-moz-focus-inner,button::-moz-focus-inner{border-style:none;padding:0}[type=button]:-moz-focusring,[type=reset]:-moz-focusring,[type=submit]:-moz-focusring,button:-moz-focusring{outline:ButtonText dotted 1px}fieldset{padding:.35em .75em .625em}legend{color:inherit;display:table;max-width:100%;white-space:normal}textarea{overflow:auto}[type=number]::-webkit-inner-spin-button,[type=number]::-webkit-outer-spin-button{height:auto}[type=search]{-webkit-appearance:textfield;outline-offset:-2px}[type=search]::-webkit-search-decoration{-webkit-appearance:none}::-webkit-file-upload-button{-webkit-appearance:button;font:inherit}summary{display:list-item}[hidden],template{display:none}`;
        const iframeStyle = iframeDoc.createElement('style');
        iframeStyle.appendChild(iframeDoc.createTextNode(normalizeCss));
        iframeDoc.head.appendChild(iframeStyle);
        }
    }
}

window.PWT.requestConvertServer = function(obj){
    var owNamespace = getGlobal();
    if(!obj.publisherId){
        logWarn(LOG_WARN_PREFIX + 'Error: publisherId is mandatory and cannot be numeric (wrap it in quotes in your config)');
        return;
    }
    var keyWords = obj.keywords;
    var defaultExtPrebid = {
        bidderparams:{
            pubmatic : {
                publisherId : obj.publisherId, 
                wrapper: {
                    profileid : obj.profileid || null,
                    versionid : obj.versionid || null,
                    keywords: keyWords || null
                }
            }
        }
    }
    var extPrebid = obj.extPrebid || defaultExtPrebid;

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
    owNamespace.addAdUnits(obj.adUnits);
}
