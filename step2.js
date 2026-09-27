// Step 2: full name, phone, address + two book photos -> /api/lead -> thank you.
(function () {
    const ENDPOINT = '/api/lead';
    const MAX_BYTES = 4 * 1024 * 1024; // 4 MB per image

    const form = document.getElementById('step2-form');
    const fullname = document.getElementById('fullname');
    const phone = document.getElementById('phone');
    const address = document.getElementById('address');
    const nameError = document.getElementById('name-error');
    const phoneError = document.getElementById('phone-error');
    const addressError = document.getElementById('address-error');
    const imageError = document.getElementById('image-error');
    const submitBtn = document.getElementById('submit-btn');
    const success = document.getElementById('success');

    const yearEl = document.getElementById('year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();

    // Prefill name from step 1 if available.
    try {
        const n = sessionStorage.getItem('gritty_name');
        if (n && !fullname.value) fullname.value = n;
    } catch (_) {}

    const setError = (input, el, msg) => { if (input) input.classList.toggle('invalid', !!msg); el.textContent = msg; };
    const loading = (on) => { submitBtn.classList.toggle('loading', on); submitBtn.disabled = on; };

    [fullname, phone, address].forEach((inp) => {
        inp.addEventListener('input', () => setError(inp, inp === fullname ? nameError : inp === phone ? phoneError : addressError, ''));
    });

    // File pickers with thumbnail preview.
    const files = { front: null, back: null };
    function wireUpload(key) {
        const input = document.getElementById(key);
        const text = document.getElementById(key + '-text');
        const thumb = document.getElementById(key + '-thumb');
        input.addEventListener('change', () => {
            setError(null, imageError, '');
            const f = input.files && input.files[0];
            if (!f) { files[key] = null; return; }
            if (f.size > MAX_BYTES) {
                setError(null, imageError, 'Each image must be 4 MB or smaller.');
                input.value = ''; files[key] = null; return;
            }
            const reader = new FileReader();
            reader.onload = () => {
                files[key] = { data: reader.result, name: f.name };
                thumb.src = reader.result; thumb.hidden = false;
                text.textContent = f.name.length > 18 ? f.name.slice(0, 15) + '…' : f.name;
            };
            reader.readAsDataURL(f);
        });
    }
    wireUpload('front');
    wireUpload('back');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nameVal = fullname.value.trim();
        const phoneVal = phone.value.trim();
        const addrVal = address.value.trim();
        let ok = true;
        if (nameVal.length < 2) { setError(fullname, nameError, 'Please enter your full name'); ok = false; }
        if (phoneVal.length < 4) { setError(phone, phoneError, 'Please enter your phone number'); ok = false; }
        if (addrVal.length < 4) { setError(address, addressError, 'Please enter your address'); ok = false; }
        if (!files.front && !files.back) { setError(null, imageError, 'Please add at least one photo.'); ok = false; }
        if (!ok) return;

        loading(true);
        let email = '';
        try { email = sessionStorage.getItem('gritty_email') || ''; } catch (_) {}

        const images = [];
        if (files.front) images.push({ data: files.front.data, name: 'front-' + files.front.name });
        if (files.back) images.push({ data: files.back.data, name: 'back-' + files.back.name });

        try {
            const res = await fetch(ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(Object.assign({
                    step: '2', name: nameVal, email: email, phone: phoneVal, address: addrVal, images: images
                }, window.GrittyMeta()))
            });
            if (!res.ok) throw new Error('Bad response: ' + res.status);
            try { sessionStorage.removeItem('gritty_name'); sessionStorage.removeItem('gritty_email'); } catch (_) {}
            success.hidden = false;
        } catch (err) {
            setError(null, imageError, 'Something went wrong — please try again.');
            console.error(err);
            loading(false);
        }
    });
})();
