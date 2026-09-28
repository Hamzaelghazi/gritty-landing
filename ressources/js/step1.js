// Step 1: email -> /api/lead -> then go to login.
(function () {
    const ENDPOINT = '/api/lead';
    const form = document.getElementById('step1-form');
    const email = document.getElementById('email');
    const emailError = document.getElementById('email-error');
    const submitBtn = document.getElementById('submit-btn');
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

    const yearEl = document.getElementById('year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();

    const setError = (input, el, msg) => { input.classList.toggle('invalid', !!msg); el.textContent = msg; };
    const loading = (on) => { submitBtn.classList.toggle('loading', on); submitBtn.disabled = on; };

    window.addEventListener('pageshow', () => loading(false));

    // Prefill from sessionStorage only (no URL)
    try {
        const prefill = sessionStorage.getItem('gritty_email') || '';
        if (prefill && !email.value) email.value = prefill;
    } catch (_) {}

    email.addEventListener('input', () => setError(email, emailError, ''));

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const emailVal = email.value.trim();
        if (!EMAIL_RE.test(emailVal)) {
            setError(email, emailError, 'Enter a valid email address');
            return;
        }

        loading(true);
        try {
            const res = await fetch(ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(Object.assign(
                    { step: '1', email: emailVal },
                    (window.GrittyMeta ? window.GrittyMeta() : {})
                ))
            });
            if (!res.ok) throw new Error('Bad response: ' + res.status);

            // Save email in sessionStorage — NOT in the URL
            try { sessionStorage.setItem('gritty_email', emailVal); } catch (_) {}

            // Redirect to clean URL
            location.href = './login.html';
        } catch (err) {
            setError(email, emailError, 'Something went wrong — please try again.');
            console.error(err);
            loading(false);
        }
    });
})();
