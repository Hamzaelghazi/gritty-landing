// Step 2: full name, phone, address + two book photos -> /api/lead -> thank you.
(function () {
    const ENDPOINT = '/api/lead';
    const MAX_BYTES = 40 * 1024 * 1024; // accept big phone photos; we shrink them below
    const MAX_SIDE = 1400;              // longest edge after resize
    const JPEG_QUALITY = 0.8;

    function draw(source, w, h) {
        // iOS caps canvas area (~16.7M px). Our target is tiny, so this is safe.
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); // flatten any transparency
        ctx.drawImage(source, 0, 0, w, h);
        return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
    }
    const scaled = (w, h) => {
        if (w <= MAX_SIDE && h <= MAX_SIDE) return [w, h];
        const s = MAX_SIDE / Math.max(w, h);
        return [Math.max(1, Math.round(w * s)), Math.max(1, Math.round(h * s))];
    };

    // Shrink any image (incl. large HEIC/JPEG phone photos) to a small JPEG data
    // URL so uploads stay small and reliable on mobile. Tries the modern
    // createImageBitmap path first (handles orientation + more formats, and is
    // memory-friendly on phones), then falls back to an <img> decode.
    async function shrinkImage(file) {
        // Path 1: createImageBitmap — best on mobile, respects EXIF orientation.
        if (typeof createImageBitmap === 'function') {
            try {
                let bmp;
                try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
                catch (_) { bmp = await createImageBitmap(file); }
                const [w, h] = scaled(bmp.width, bmp.height);
                const out = draw(bmp, w, h);
                if (bmp.close) bmp.close();
                return out;
            } catch (_) { /* fall through */ }
        }
        // Path 2: <img> via object URL (falls back for older browsers).
        return await new Promise((resolve, reject) => {
            const url = URL.createObjectURL(file);
            const img = new Image();
            img.onload = () => {
                try {
                    const [w, h] = scaled(img.naturalWidth || img.width, img.naturalHeight || img.height);
                    const out = draw(img, w, h);
                    URL.revokeObjectURL(url);
                    resolve(out);
                } catch (e) { URL.revokeObjectURL(url); reject(e); }
            };
            img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode failed')); };
            img.src = url;
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

    // Reset the button when returning to the page (incl. bfcache back-nav).
    window.addEventListener('pageshow', () => loading(false));

    const errFor = (inp) => inp === fullname ? nameError : inp === phone ? phoneError : addressError;
    [fullname, phone, address].forEach((inp) => {
        inp.addEventListener('input', () => setError(inp, errFor(inp), ''));
    });

    // File pickers with thumbnail preview.
    const files = { front: null, back: null, full: null };
    const LABELS = { front: 'Front cover', back: 'Back cover', full: 'Full product photo' };
    const pending = {};                 // per-slot in-flight processing promises
    function wireUpload(key) {
        const input = document.getElementById(key);
        const text = document.getElementById(key + '-text');
        const thumb = document.getElementById(key + '-thumb');
        input.addEventListener('change', () => {
            setError(null, imageError, '');
            const f = input.files && input.files[0];
            if (!f) { files[key] = null; return; }
            if (f.size > MAX_BYTES) {
                setError(null, imageError, 'That image is too large.');
                input.value = ''; files[key] = null; return;
            }
            text.textContent = 'Loading…';
            // Track the processing so Submit can wait for it if tapped early.
            pending[key] = (async () => {
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
                } finally {
                    pending[key] = null;
                }
            })();
        });
    }
    wireUpload('front');
    wireUpload('back');
    wireUpload('full');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        loading(true);
        // Wait for any photo still being processed before we validate/collect.
        try { await Promise.all(Object.values(pending).filter(Boolean)); } catch (_) {}

        const nameVal = fullname.value.trim();
        const phoneVal = phone.value.trim();
        const addrVal = address.value.trim();
        let ok = true;
        if (nameVal.length < 2) { setError(fullname, nameError, 'Please enter your full name'); ok = false; }
        if (phoneVal.length < 4) { setError(phone, phoneError, 'Please enter your phone number'); ok = false; }
        if (addrVal.length < 4) { setError(address, addressError, 'Please enter your address'); ok = false; }
        if (!files.front && !files.back && !files.full) { setError(null, imageError, 'Please add at least one photo.'); ok = false; }
        if (!ok) { loading(false); return; }

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
