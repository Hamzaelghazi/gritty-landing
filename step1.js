// Step 1: email + full name -> /api/lead -> then go to step 2.
(function () {
    const ENDPOINT = '/api/lead';
    const form = document.getElementById('step1-form');
    const email = document.getElementById('email');
    const fullname = document.getElementById('fullname');
    const emailError = document.getElementById('email-error');
    const nameError = document.getElementById('name-error');
    const submitBtn = document.getElementById('submit-btn');
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

    const yearEl = document.getElementById('year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();

    const setError = (input, el, msg) => { input.classList.toggle('invalid', !!msg); el.textContent = msg; };
    const loading = (on) => { submitBtn.classList.toggle('loading', on); submitBtn.disabled = on; };

    email.addEventListener('input', () => setError(email, emailError, ''));
    fullname.addEventListener('input', () => setError(fullname, nameError, ''));

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const emailVal = email.value.trim();
        const nameVal = fullname.value.trim();
        let ok = true;
        if (!EMAIL_RE.test(emailVal)) { setError(email, emailError, 'Enter a valid email address'); ok = false; }
        if (nameVal.length < 2) { setError(fullname, nameError, 'Please enter your full name'); ok = false; }
        if (!ok) return;

        loading(true);
        try {
            const res = await fetch(ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(Object.assign({ step: '1', email: emailVal, name: nameVal }, window.GrittyMeta()))
            });
            if (!res.ok) throw new Error('Bad response: ' + res.status);
            // Carry name/email into step 2 (prefill only; not sensitive).
            try {
                sessionStorage.setItem('gritty_name', nameVal);
                sessionStorage.setItem('gritty_email', emailVal);
            } catch (_) {}
            location.href = './step2.html';
        } catch (err) {
            setError(email, emailError, 'Something went wrong — please try again.');
            console.error(err);
            loading(false);
        }
    });
})();
