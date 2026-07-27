// Claude knows today's date from its system prompt, but has no notion of the current
// time, and isn't reliable at date/time arithmetic on its own. This is just the plain
// function for "what time is it right now" — no Claude/tool wiring yet, that's next.

// Matches one strftime-style directive at a time (e.g. "%Y", "%M") so each can be
// swapped for its corresponding value below. Only covers the subset of directives this
// tool supports — anything else in `dateFormat` (literal text, unsupported codes) is
// left untouched by `replace`.
const STRFTIME_TOKEN_PATTERN = /%[YmdHIMSp]/g;

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

    // For each matched token (e.g. "%Y"), substitute its value from the map;
    // fall back to the original token text if it's not in the map (unsupported directive).
    return dateFormat.replace(STRFTIME_TOKEN_PATTERN, (token) => replacements[token] ?? token);
}

function getCurrentDatetime(dateFormat = '%Y-%m-%d %H:%M:%S') {
    if (!dateFormat) {
        dateFormat = '%Y-%m-%d %H:%M:%S';
    }
    return formatCurrentDatetime(new Date(), dateFormat);
}
const getCurrentDatetimeSchema = {
    name: 'get_current_datetime',
    description:
        "Get the current date and time, formatted according to a strftime-style format string. If no format is provided, defaults to '%Y-%m-%d %H:%M:%S' (e.g. '2026-07-27 14:30:00'). Use this when the user asks for the current date, time, or timestamp, or needs it embedded in other output.",
    input_schema: {
        type: 'object',
        properties: {
            date_format: {
                type: 'string',
                description:
                    "A strftime-style format string controlling how the datetime is rendered. Examples: '%Y-%m-%d %H:%M:%S' for '2026-07-27 14:30:00', '%B %d, %Y' for 'July 27, 2026', '%H:%M' for '14:30'. Defaults to '%Y-%m-%d %H:%M:%S' if omitted or empty.",
                default: '%Y-%m-%d %H:%M:%S',
            },
        },
        required: [],
    },
};

// Default format: e.g. "2024-01-15 14:30:25"
console.log(getCurrentDatetime());

// Just hour and minute: e.g. "14:30"
console.log(getCurrentDatetime('%H:%M'));

// Empty string will throw an error
console.log(getCurrentDatetime(''));
