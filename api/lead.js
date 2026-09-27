// Serverless function: receives a lead from the landing page and forwards it
// to your Telegram bot. CommonJS form — works on Vercel with no package.json.
//
// SET THESE AS ENVIRONMENT VARIABLES on Vercel — never hard-code them here:
//   TELEGRAM_BOT_TOKEN   the token from @BotFather, e.g. 123456:AA...
//   TELEGRAM_CHAT_ID     where to deliver leads. One id, or several separated
//                        by commas: a person's id (they must /start the bot
//                        first) or a group id (negative, e.g. -100...).
//                        Example: 6057228033,8857734149,-1001234567890

// Turn a User-Agent string into a short, human-readable device summary.
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

    // Body may arrive parsed (Vercel) or as a raw string.
    let body = req.body;
    if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch (e) { body = {}; }
    }
    body = body || {};

    const clip = (v, n) => String(v || '').trim().slice(0, n);
    const name = clip(body.name, 100);
    const email = clip(body.email, 200);
    const message = clip(body.message, 1000);
    const page = clip(body.page, 300);

    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
    if (name.length < 2 || !emailOk) {
        res.status(400).json({ error: 'Invalid name or email' });
        return;
    }

    // --- Lead targeting metadata ---
    // Visitor IP (Vercel puts the real client IP in x-forwarded-for).
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

    // Best-effort IP geolocation (free, no key). Never blocks lead delivery.
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
        } catch (e) { /* ignore geo failures */ }
    }

    const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const row = (label, val) => val ? label + ' ' + esc(val) + '\n' : '';

    const text =
        '🚀 <b>New Gritty-ify lead</b>\n\n' +
        row('👤 <b>Name:</b>', name) +
        row('✉️ <b>Email:</b>', email) +
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

    const send = (chatId) => fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true })
    }).then((r) => r.json());

    try {
        const results = await Promise.all(chatIds.map(send));
        // Succeed if the lead reached at least one recipient; log any that failed
        // (e.g. a person who hasn't pressed /start yet, or a bad group id).
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
