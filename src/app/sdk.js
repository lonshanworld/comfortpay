
(function() {
    if (window.ComfortPay) {
        return;
    }

    console.log("ComfortPay SDK Initialized.");

    let iframe = null;
    let overlay = null;
    let merchantOrigin = '*'; // Default to wildcard

    function createOverlay() {
        const el = document.createElement('div');
        el.style.position = 'fixed';
        el.style.top = '0';
        el.style.left = '0';
        el.style.right = '0';
        el.style.bottom = '0';
        el.style.backgroundColor = 'rgba(0, 0, 0, 0.6)';
        el.style.zIndex = '2147483646'; // Max z-index - 1
        el.style.opacity = '0';
        el.style.transition = 'opacity 0.3s ease-in-out';
        document.body.appendChild(el);
        // Trigger reflow to start transition
        setTimeout(() => el.style.opacity = '1', 10);
        return el;
    }

    function createIframe(sessionToken) {
        const el = document.createElement('iframe');
        // The base URL should be your application's domain
        const baseUrl = window.location.origin;
        el.src = `${baseUrl}/checkout/new?session=${sessionToken}&display=modal`;

        el.style.position = 'fixed';
        el.style.top = '50%';
        el.style.left = '50%';
        el.style.transform = 'translate(-50%, -50%) scale(0.95)';
        el.style.width = '100%';
        el.style.maxWidth = '920px';
        el.style.height = '90%';
        el.style.maxHeight = '720px';
        el.style.border = 'none';
        el.style.borderRadius = '8px';
        el.style.boxShadow = '0 10px 25px rgba(0,0,0,0.2)';
        el.style.zIndex = '2147483647'; // Max z-index
        el.style.opacity = '0';
        el.style.transition = 'opacity 0.3s ease-in-out 0.1s, transform 0.3s ease-in-out 0.1s';

        document.body.appendChild(el);
        // Trigger reflow to start transition
        setTimeout(() => {
            el.style.opacity = '1';
            el.style.transform = 'translate(-50%, -50%) scale(1)';
        }, 10);
        return el;
    }

    function close() {
        if (iframe) {
            iframe.style.opacity = '0';
            iframe.style.transform = 'translate(-50%, -50%) scale(0.95)';
            setTimeout(() => {
                document.body.removeChild(iframe);
                iframe = null;
            }, 300);
        }
        if (overlay) {
            overlay.style.opacity = '0';
            setTimeout(() => {
                document.body.removeChild(overlay);
                overlay = null;
            }, 300);
        }
    }

    function open(options) {
        if (!options.sessionToken) {
            console.error("ComfortPay.open() requires a sessionToken.");
            return;
        }

        // Decode session token to get merchantOrigin for secure communication
        try {
            const decoded = JSON.parse(atob(options.sessionToken));
            if (decoded.merchantOrigin) {
                merchantOrigin = decoded.merchantOrigin;
            }
        } catch(e) {
            console.warn("Could not decode session token to set merchant origin. Defaulting to wildcard. This is not recommended for production.");
            merchantOrigin = '*';
        }

        overlay = createOverlay();
        iframe = createIframe(options.sessionToken);

        overlay.addEventListener('click', close);
    }

    function handleMessage(event) {
        // Use the dynamic origin for validation if available, otherwise wildcard
        if (merchantOrigin !== '*' && event.origin !== merchantOrigin) {
            console.warn(`Message from unexpected origin ${event.origin} was blocked.`);
            return;
        }

        const { type, data } = event.data;

        if (type === 'comfortPay:close') {
            close();
        }
        if (type === 'comfortPay:success') {
            close();
        }
    }

    window.ComfortPay = {
        open: open
    };

    window.addEventListener('message', handleMessage);

})();
