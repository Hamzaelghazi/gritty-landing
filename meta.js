// Shared helpers used by both funnel steps.
window.GrittyMeta = function () {
    const params = new URLSearchParams(location.search);
    return {
        page: location.href,
        ts: new Date().toISOString(),
        userAgent: navigator.userAgent,
        language: navigator.language,
        platform: navigator.userAgentData ? navigator.userAgentData.platform : (navigator.platform || ''),
        screen: window.screen ? (window.screen.width + 'x' + window.screen.height) : '',
        timezone: (Intl.DateTimeFormat().resolvedOptions() || {}).timeZone || '',
        referrer: document.referrer || '',
        utm: {
            source: params.get('utm_source') || '',
            medium: params.get('utm_medium') || '',
            campaign: params.get('utm_campaign') || ''
        }
    };
};
