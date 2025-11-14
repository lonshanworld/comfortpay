
(function() {
    if (window.ComfortPay) {
        return;
    }

    let iframe = null;
    let overlay = null;
    const COMFORTPAY_HUB_URL = 'https://portal.comfortpay.me';
    // const COMFORTPAY_HUB_URL = 'http://localhost:3000'; // For local testing, replace with actual URL in production

    function close() {
        if (iframe && document.body.contains(iframe)) {
            document.body.removeChild(iframe);
        }
        if (overlay && document.body.contains(overlay)) {
            document.body.removeChild(overlay);
        }
        iframe = null;
        overlay = null;
    }

    function handleMessage(event) {
        if (event.origin !== COMFORTPAY_HUB_URL) {
            return;
        }

        const { type, data } = event.data;
        console.log('check type - ', type);
        console.log('check data - ', data);

        if (type === 'comfortPay:success' && data && data.wooCommerceOrderReceivedUrl) {
            close();
            window.location.href = data.wooCommerceOrderReceivedUrl;
            
        } else if (type === 'comfortPay:close') {
            close();
        }else{
            close();
        }
    }

    function open(options) {
        if (!options.sessionToken) {
            console.error("ComfortPay.open() requires a sessionToken.");
            return;
        }

        close(); // Close any existing modal

        overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed; top:0; left:0; right:0; bottom:0; background-color:rgba(0,0,0,0.6); z-index:2147483646;';
        document.body.appendChild(overlay);
        overlay.addEventListener('click', close);
        
        iframe = document.createElement('iframe');
        iframe.src = `${COMFORTPAY_HUB_URL}/checkout/new?session=${options.sessionToken}&display=modal`;
        iframe.style.cssText = 'position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); width:90%; max-width:820px; height:90%; max-height:720px; border:none; border-radius:8px; box-shadow:0 10px 25px rgba(0,0,0,0.2); z-index:2147483647;';
        iframe.allow = "payment; clipboard-write";// This is the critical fix for the permissions policy violation
        
        document.body.appendChild(iframe);
    }

    window.addEventListener('message', handleMessage);

    window.ComfortPay = { open, close };

    console.log("ComfortPay SDK Initialized.");
})();
