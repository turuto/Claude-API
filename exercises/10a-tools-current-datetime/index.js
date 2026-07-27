// Claude knows today's date from its system prompt, but has no notion of the current
// time, and isn't reliable at date/time arithmetic on its own. This is just the plain
// function for "what time is it right now" — no Claude/tool wiring yet, that's next.

function formatCurrentDatetime(date, dateFormat) {
    const pad = (n) => String(n).padStart(2, '0');
    const hour24 = date.getHours();
    const hour12 = hour24 % 12 || 12;

    const replacements = {
        '%Y': String(date.getFullYear()),
        '%m': pad(date.getMonth() + 1),
        '%d': pad(date.getDate()),
        '%H': pad(hour24),
        '%I': pad(hour12),
        '%M': pad(date.getMinutes()),
        '%S': pad(date.getSeconds()),
        '%p': hour24 < 12 ? 'AM' : 'PM',
    };

    return dateFormat.replace(/%[YmdHIMSp]/g, (token) => replacements[token] ?? token);
}

function getCurrentDatetime(dateFormat = '%Y-%m-%d %H:%M:%S') {
    if (!dateFormat) {
        dateFormat = '%Y-%m-%d %H:%M:%S';
    }
    return formatCurrentDatetime(new Date(), dateFormat);
}

// Default format: e.g. "2024-01-15 14:30:25"
console.log(getCurrentDatetime());

// Just hour and minute: e.g. "14:30"
console.log(getCurrentDatetime('%H:%M'));

// Empty string will throw an error
console.log(getCurrentDatetime(''));
