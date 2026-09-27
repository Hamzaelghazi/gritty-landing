// Serverless function: receives a lead from the landing page and forwards it
// to your Telegram bot. CommonJS form — works on Vercel with no package.json.
//
// SET THESE AS ENVIRONMENT VARIABLES on Vercel — never hard-code them here:
//   TELEGRAM_BOT_TOKEN   the token from @BotFather, e.g. 123456:AA...
//   TELEGRAM_CHAT_ID     where to deliver leads. One id, or several separated
//                        by commas: a person's id (they must /start the bot
//                        first) or a group id (negative, e.g. -100...).
//                        Example: 6057228033,8857734149,-1001234567890

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

    const name = String(body.name || '').trim().slice(0, 100);
    const email = String(body.email || '').trim().slice(0, 200);
    const page = String(body.page || '').trim().slice(0, 300);

    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
    if (name.length < 2 || !emailOk) {
        res.status(400).json({ error: 'Invalid name or email' });
        return;
    }

    const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const text =
        '🚀 <b>New Gritty-ify lead</b>\n\n' +
        '👤 <b>Name:</b> ' + esc(name) + '\n' +
        '✉️ <b>Email:</b> ' + esc(email) + '\n' +
        (page ? '🔗 <b>From:</b> ' + esc(page) + '\n' : '') +
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
