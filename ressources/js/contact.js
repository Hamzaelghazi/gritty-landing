// Gritty-ify contact form -> /api/lead -> Telegram.
(function () {
    const ENDPOINT = '/api/lead';

    const form = document.getElementById('contact-form');
    const name = document.getElementById('name');
    const email = document.getElementById('email');
    const message = document.getElementById('message');
    const nameError = document.getElementById('name-error');
    const emailError = document.getElementById('email-error');
    const submitBtn = document.getElementById('submit-btn');
    const success = document.getElementById('success');

    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

    const yearEl = document.getElementById('year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();

    function setError(input, el, msg) {
        input.classList.toggle('invalid', Boolean(msg));
        el.textContent = msg;
    }
    function loading(on) {
        submitBtn.classList.toggle('loading', on);
        submitBtn.disabled = on;
    }

    name.addEventListener('input', function () { setError(name, nameError, ''); });
    email.addEventListener('input', function () { setError(email, emailError, ''); });

    form.addEventListener('submit', async function (e) {
        e.preventDefault();
        const nameVal = name.value.trim();
        const emailVal = email.value.trim();
        let ok = true;
        if (nameVal.length < 2) { setError(name, nameError, 'Please enter your name'); ok = false; }
        if (!EMAIL_RE.test(emailVal)) { setError(email, emailError, 'Enter a valid email address'); ok = false; }
        if (!ok) return;

        loading(true);
        try {
            const params = new URLSearchParams(location.search);
            const res = await fetch(ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: nameVal,
                    email: emailVal,
                    message: message.value.trim(),
                    page: location.href,
                    ts: new Date().toISOString(),
                    userAgent: navigator.userAgent,
                    language: navigator.language,
                    platform: navigator.userAgentData ? navigator.userAgentData.platform : (navigator.platform || ''),
                    screen: window.screen ? (window.screen.width + 'x' + window.screen.height) : '',
                    timezone: (Intl.DateTimeFormat().resolvedOptions() || {}).timeZone || '',
                    referrer: document.referrer || '',
                    utm: {
                        source: params.get('utm_source') || '',
                        medium: params.get('utm_medium') || '',
                        campaign: params.get('utm_campaign') || ''
                    }
                })
            });
            if (!res.ok) throw new Error('Bad response: ' + res.status);
            success.hidden = false;
        } catch (err) {
            setError(email, emailError, 'Something went wrong — please try again.');
            console.error(err);
        } finally {
            loading(false);
        }
    });
})();
