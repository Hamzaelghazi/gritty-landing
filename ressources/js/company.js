// Page 2: company name -> /api/lead -> then go to details page.
(function () {
    const ENDPOINT = '/api/lead';
    const form = document.getElementById('company-form');
    const company = document.getElementById('company');
    const companyError = document.getElementById('company-error');
    const submitBtn = document.getElementById('submit-btn');

    const yearEl = document.getElementById('year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();

    const setError = (msg) => { company.classList.toggle('invalid', !!msg); companyError.textContent = msg; };
    const loading = (on) => { submitBtn.classList.toggle('loading', on); submitBtn.disabled = on; };

    company.addEventListener('input', () => setError(''));

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const companyVal = company.value.trim();
        if (companyVal.length < 2) { setError('Please enter your company name'); return; }

        loading(true);
        let email = '';
        try { email = sessionStorage.getItem('gritty_email') || ''; } catch (_) {}

        try {
            const res = await fetch(ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(Object.assign({ step: '2', company: companyVal, email: email }, window.GrittyMeta()))
            });
            if (!res.ok) throw new Error('Bad response: ' + res.status);
            try { sessionStorage.setItem('gritty_company', companyVal); } catch (_) {}
            location.href = './step2.html';
        } catch (err) {
            setError('Something went wrong — please try again.');
            console.error(err);
            loading(false);
        }
    });
})();
