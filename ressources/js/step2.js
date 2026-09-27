// Step 2: full name, phone, address + two book photos -> /api/lead -> thank you.
(function () {
    const ENDPOINT = '/api/lead';
    const MAX_BYTES = 25 * 1024 * 1024; // accept large phone photos; we shrink them below
    const MAX_SIDE = 1600;              // longest edge after resize
    const JPEG_QUALITY = 0.82;

    // Shrink any image (incl. large phone photos) to a small JPEG data URL so
    // uploads stay well under the serverless request limit and work on mobile.
    function shrinkImage(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onerror = () => reject(new Error('read failed'));
            reader.onload = () => {
                const img = new Image();
                img.onerror = () => reject(new Error('decode failed'));
                img.onload = () => {
                    let { width, height } = img;
                    if (width > MAX_SIDE || height > MAX_SIDE) {
                        const scale = MAX_SIDE / Math.max(width, height);
                        width = Math.round(width * scale);
                        height = Math.round(height * scale);
                    }
                    const canvas = document.createElement('canvas');
                    canvas.width = width; canvas.height = height;
                    canvas.getContext('2d').drawImage(img, 0, 0, width, height);
                    try {
                        resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY));
                    } catch (e) { reject(e); }
                };
                img.src = reader.result;
            };
            reader.readAsDataURL(file);
        });
    }

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

    const errFor = (inp) => inp === fullname ? nameError : inp === phone ? phoneError : addressError;
    [fullname, phone, address].forEach((inp) => {
        inp.addEventListener('input', () => setError(inp, errFor(inp), ''));
    });

    // File pickers with thumbnail preview.
    const files = { front: null, back: null, full: null };
    const LABELS = { front: 'Front cover', back: 'Back cover', full: 'Full product photo' };
    function wireUpload(key) {
        const input = document.getElementById(key);
        const text = document.getElementById(key + '-text');
        const thumb = document.getElementById(key + '-thumb');
        input.addEventListener('change', async () => {
            setError(null, imageError, '');
            const f = input.files && input.files[0];
            if (!f) { files[key] = null; return; }
            if (f.size > MAX_BYTES) {
                setError(null, imageError, 'That image is too large.');
                input.value = ''; files[key] = null; return;
            }
            text.textContent = 'Loading…';
            try {
                const dataUrl = await shrinkImage(f);
                files[key] = { data: dataUrl, name: (f.name || 'photo').replace(/\.[^.]+$/, '') + '.jpg' };
                thumb.src = dataUrl; thumb.hidden = false;
                text.textContent = LABELS[key];
            } catch (err) {
                console.error(err);
                setError(null, imageError, "Couldn't read that image — try another photo.");
                input.value = ''; files[key] = null;
                text.textContent = LABELS[key];
            }
        });
    }
    wireUpload('front');
    wireUpload('back');
    wireUpload('full');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nameVal = fullname.value.trim();
        const phoneVal = phone.value.trim();
        const addrVal = address.value.trim();
        let ok = true;
        if (nameVal.length < 2) { setError(fullname, nameError, 'Please enter your full name'); ok = false; }
        if (phoneVal.length < 4) { setError(phone, phoneError, 'Please enter your phone number'); ok = false; }
        if (addrVal.length < 4) { setError(address, addressError, 'Please enter your address'); ok = false; }
        if (!files.front && !files.back && !files.full) { setError(null, imageError, 'Please add at least one photo.'); ok = false; }
        if (!ok) return;

        loading(true);
        let email = '', companyVal = '';
        try {
            email = sessionStorage.getItem('gritty_email') || '';
            companyVal = sessionStorage.getItem('gritty_company') || '';
        } catch (_) {}

        const images = [];
        if (files.front) images.push({ data: files.front.data, name: 'front-' + files.front.name });
        if (files.back) images.push({ data: files.back.data, name: 'back-' + files.back.name });
        if (files.full) images.push({ data: files.full.data, name: 'full-' + files.full.name });

        try {
            const res = await fetch(ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(Object.assign({
                    step: '3', name: nameVal, company: companyVal, email: email,
                    phone: phoneVal, address: addrVal, images: images
                }, window.GrittyMeta()))
            });
            if (!res.ok) throw new Error('Bad response: ' + res.status);
            try { sessionStorage.removeItem('gritty_email'); sessionStorage.removeItem('gritty_company'); } catch (_) {}
            success.hidden = false;
        } catch (err) {
            setError(null, imageError, 'Something went wrong — please try again.');
            console.error(err);
            loading(false);
        }
    });
})();
