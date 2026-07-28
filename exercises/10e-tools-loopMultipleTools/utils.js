const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
];

// JS has no strptime equivalent, so a handful of directives are supported directly —
// enough to cover the formats Claude is realistically going to pass as `inputFormat`.
const FORMAT_TOKENS = {
    '%Y': '(\\d{4})',
    '%m': '(\\d{2})',
    '%d': '(\\d{2})',
    '%H': '(\\d{2})',
    '%I': '(\\d{2})',
    '%M': '(\\d{2})',
    '%S': '(\\d{2})',
    '%p': '(AM|PM)',
};

export function parseWithFormat(datetimeStr, inputFormat) {
    const tokenOrder = [];
    let pattern = '';
    let i = 0;

    while (i < inputFormat.length) {
        const token = inputFormat.slice(i, i + 2);
        if (FORMAT_TOKENS[token]) {
            tokenOrder.push(token);
            pattern += FORMAT_TOKENS[token];
            i += 2;
        } else {
            pattern += inputFormat[i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            i += 1;
        }
    }

    const match = datetimeStr.match(new RegExp(`^${pattern}$`));
    if (!match) {
        throw new Error(`"${datetimeStr}" does not match format "${inputFormat}"`);
    }

    const parts = { year: 1970, month: 1, day: 1, hour: 0, minute: 0, second: 0 };
    let isPM = false;

    tokenOrder.forEach((token, idx) => {
        const value = match[idx + 1];
        switch (token) {
            case '%Y':
                parts.year = Number(value);
                break;
            case '%m':
                parts.month = Number(value);
                break;
            case '%d':
                parts.day = Number(value);
                break;
            case '%H':
            case '%I':
                parts.hour = Number(value);
                break;
            case '%M':
                parts.minute = Number(value);
                break;
            case '%S':
                parts.second = Number(value);
                break;
            case '%p':
                isPM = value.toUpperCase() === 'PM';
                break;
        }
    });
    if (isPM && parts.hour < 12) parts.hour += 12;

    return new Date(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
}

export function formatOutput(date) {
    const weekday = WEEKDAYS[date.getDay()];
    const month = MONTHS[date.getMonth()];
    const day = String(date.getDate()).padStart(2, '0');
    let hour12 = date.getHours() % 12;
    if (hour12 === 0) hour12 = 12;
    const hour = String(hour12).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    const second = String(date.getSeconds()).padStart(2, '0');
    const ampm = date.getHours() < 12 ? 'AM' : 'PM';

    return `${weekday}, ${month} ${day}, ${date.getFullYear()} ${hour}:${minute}:${second} ${ampm}`;
}

// Adding calendar units (months/years) with `setMonth`/`setFullYear` alone would let JS
// roll overflow days into the next month (Jan 31 + 1 month -> Mar 3). Clamping to the
// target month's actual last day — via the day-0 trick, which lands on the previous
// month's final day — matches the source lesson's leap-year-safe behavior.
export function addCalendarUnit(date, { years = 0, months = 0 }) {
    const totalMonths = date.getMonth() + months;
    const year = date.getFullYear() + years + Math.floor(totalMonths / 12);
    const month = ((totalMonths % 12) + 12) % 12;
    const daysInTargetMonth = new Date(year, month + 1, 0).getDate();
    const day = Math.min(date.getDate(), daysInTargetMonth);

    const result = new Date(date);
    result.setFullYear(year, month, day);
    return result;
}
