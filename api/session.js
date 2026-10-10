// api/session.js — validates short-lived session id and returns minimal data
if (!globalThis.__SESSIONS) globalThis.__SESSIONS = new Map();
const SESSIONS = globalThis.__SESSIONS;

module.exports = async (req, res) => {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    const { id } = req.query || {};
    if (!id) {
        res.status(400).json({ error: 'id required' });
        return;
    }

    const record = SESSIONS.get(id);
    if (!record) {
        res.status(404).json({ error: 'expired' });
        return;
    }
    if (Date.now() > record.expires) {
        SESSIONS.delete(id);
        res.status(410).json({ error: 'expired' });
        return;
    }

    // Return only what's needed to render the next page
    res.status(200).json({
        email: record.email || '',
        company: record.company || '',
        step: record.step || ''
    });
};
