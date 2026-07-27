// A tool Claude can call to do the date math it's bad at on its own: given a datetime
// and a duration, return the resulting datetime. No API call here yet — this exercise
// is just the tool function and its schema; wiring it into a tool-use loop comes later.
//
// The strptime-style parsing/formatting plumbing lives in ./utils.js, so this file can
// stay focused on the tool itself and the schema Claude sees.

import { parseWithFormat, formatOutput, addCalendarUnit } from './utils.js';

function addDurationToDatetime({ datetimeStr, duration = 0, unit = 'days', inputFormat = '%Y-%m-%d' }) {
    const date = parseWithFormat(datetimeStr, inputFormat);
    let newDate;

    switch (unit) {
        case 'seconds':
            newDate = new Date(date.getTime() + duration * 1000);
            break;
        case 'minutes':
            newDate = new Date(date.getTime() + duration * 60 * 1000);
            break;
        case 'hours':
            newDate = new Date(date.getTime() + duration * 60 * 60 * 1000);
            break;
        case 'days':
            newDate = new Date(date.getTime() + duration * 24 * 60 * 60 * 1000);
            break;
        case 'weeks':
            newDate = new Date(date.getTime() + duration * 7 * 24 * 60 * 60 * 1000);
            break;
        case 'months':
            newDate = addCalendarUnit(date, { months: duration });
            break;
        case 'years':
            newDate = addCalendarUnit(date, { years: duration });
            break;
        default:
            throw new Error(`Unsupported time unit: ${unit}`);
    }

    return formatOutput(newDate);
}

const addDurationToDatetimeSchema = {
    name: 'add_duration_to_datetime',
    description:
        'Adds a specified duration to a datetime string and returns the resulting datetime in a detailed ' +
        'format. This tool converts an input datetime string to a datetime, adds the specified duration in ' +
        'the requested unit, and returns a formatted string of the resulting datetime. It handles various ' +
        'time units including seconds, minutes, hours, days, weeks, months, and years, with special handling ' +
        'for month and year calculations to account for varying month lengths and leap years. The output is ' +
        'always returned in a detailed format that includes the day of the week, month name, day, year, and ' +
        "time with AM/PM indicator (e.g., 'Thursday, April 03, 2025 10:30:00 AM').",
    input_schema: {
        type: 'object',
        properties: {
            datetimeStr: {
                type: 'string',
                description:
                    'The input datetime string to which the duration will be added. This should be ' +
                    'formatted according to the inputFormat parameter.',
            },
            duration: {
                type: 'number',
                description:
                    'The amount of time to add to the datetime. Can be positive (for future dates) or ' +
                    'negative (for past dates). Defaults to 0.',
            },
            unit: {
                type: 'string',
                description:
                    "The unit of time for the duration. Must be one of: 'seconds', 'minutes', 'hours', " +
                    "'days', 'weeks', 'months', or 'years'. Defaults to 'days'.",
            },
            inputFormat: {
                type: 'string',
                description:
                    'The format string for parsing datetimeStr, using Python strptime-style format codes ' +
                    "('%Y', '%m', '%d', '%H', '%I', '%M', '%S', '%p'). For example, '%Y-%m-%d' for ISO dates " +
                    "like '2025-04-03'. Defaults to '%Y-%m-%d'.",
            },
        },
        required: ['datetimeStr'],
    },
};

console.log(addDurationToDatetime({ datetimeStr: '2025-04-03', duration: 10, unit: 'days' }));
console.log(addDurationToDatetime({ datetimeStr: '2025-01-31', duration: 1, unit: 'months' }));
console.log(addDurationToDatetime({ datetimeStr: '2024-02-29', duration: 1, unit: 'years' }));
console.log(
    addDurationToDatetime({
        datetimeStr: '04/03/2025 09:15:00 AM',
        duration: -90,
        unit: 'minutes',
        inputFormat: '%m/%d/%Y %I:%M:%S %p',
    }),
);
