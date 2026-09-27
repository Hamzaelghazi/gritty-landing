// Serverless function: receives a lead from the landing page and forwards it
// to your Telegram bot. CommonJS form — works on Vercel with no package.json.
//
// SET THESE AS ENVIRONMENT VARIABLES on Vercel — never hard-code them here:
//   TELEGRAM_BOT_TOKEN   the token from @BotFather, e.g. 123456:AA...
//   TELEGRAM_CHAT_ID     where to deliver leads (your user id, or a group id)

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) {
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

    try {
        const tgRes = await fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true })
        });
        const data = await tgRes.json();
        if (!data.ok) {
            console.error('Telegram error:', data);
            res.status(502).json({ error: 'Telegram rejected the message', detail: data.description || '' });
            return;
        }
        res.status(200).json({ ok: true });
    } catch (err) {
        console.error(err);
        res.status(502).json({ error: 'Could not reach Telegram' });
    }
};
