// A conversation loop that keeps running tools — possibly several different ones, in
// sequence — until Claude stops asking for one. "What day is 103 days from today?" needs
// get_current_datetime AND add_duration_to_datetime, one after the other: Claude can't
// call the second until it has the first's result, so this can't be done as a single
// fixed round trip like 10d — the loop keeps going as long as response.stop_reason is
// "tool_use", not just once.
//
// addUserMessage/addAssistantMessage are refactored to accept a plain string, an array of
// content blocks, OR a full API response object (unwrapping its .content automatically),
// so runConversation below can pass chat()'s return value straight through.

import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import { parseWithFormat, formatOutput, addCalendarUnit } from './utils.js';

// ANTHROPIC_API_KEY is already loaded into process.env by dotenv/config above.
const client = new Anthropic();

// Same tool from 10a-tools-current-datetime, duplicated here since each exercise is
// self-contained (see CLAUDE.md conventions).
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

// Same tool from 10z-tools-add-duration, duplicated here for the same reason. Its schema
// properties are renamed to snake_case (datetime_str, input_format) to match
// get_current_datetime's wire-facing naming — 10z predates that convention and kept its
// own camelCase names, but with two tools side by side in one file the mismatch would be
// distracting. addDurationToDatetime's own parameter names stay camelCase; only the
// schema (and the TOOL_FUNCTIONS mapping below) changed.
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
            datetime_str: {
                type: 'string',
                description:
                    'The input datetime string to which the duration will be added. This should be ' +
                    'formatted according to the input_format parameter.',
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
            input_format: {
                type: 'string',
                description:
                    'The format string for parsing datetime_str, using strptime-style format codes ' +
                    "('%Y', '%m', '%d', '%H', '%I', '%M', '%S', '%p'). For example, '%Y-%m-%d' for ISO dates " +
                    "like '2025-04-03'. Defaults to '%Y-%m-%d'.",
            },
        },
        required: ['datetime_str'],
    },
};

const TOOLS = [getCurrentDatetimeSchema, addDurationToDatetimeSchema];

// Maps each tool schema's (snake_case) name to the function that runs it, translating its
// wire-format input into that function's own (camelCase) parameters.
const TOOL_FUNCTIONS = {
    get_current_datetime: (input) => getCurrentDatetime(input.date_format),
    add_duration_to_datetime: (input) =>
        addDurationToDatetime({
            datetimeStr: input.datetime_str,
            duration: input.duration,
            unit: input.unit,
            inputFormat: input.input_format,
        }),
};

// Runs the function a tool_use block asked for. Unlike 10d, this can genuinely fail —
// add_duration_to_datetime throws on an unparseable date or unsupported unit — so is_error
// now does real work: true tells Claude the call didn't succeed instead of treating the
// error message as a normal result.
function runTool(toolUseBlock) {
    const fn = TOOL_FUNCTIONS[toolUseBlock.name];
    let content;
    let isError = false;

    try {
        content = String(fn(toolUseBlock.input));
    } catch (error) {
        content = error.message;
        isError = true;
    }

    console.log(`  ran ${toolUseBlock.name}(${JSON.stringify(toolUseBlock.input)}) -> ${content}`);

    return {
        type: 'tool_result',
        tool_use_id: toolUseBlock.id,
        content,
        is_error: isError,
    };
}

// Claude is stateless between requests — the only way it "remembers" earlier turns is
// that we resend the full message history with every call. This array grows each turn.
const messages = [];

// Accepts a string, an array of content blocks, or a full API response object — the last
// case unwraps `.content` automatically, so callers (runConversation below) can pass
// chat()'s return value straight through without extracting .content themselves first.
function addUserMessage(message) {
    let content;
    if (typeof message === 'string' || Array.isArray(message)) {
        content = message;
    } else {
        content = message.content;
    }
    messages.push({ role: 'user', content });
}

function addAssistantMessage(message) {
    let content;
    if (typeof message === 'string' || Array.isArray(message)) {
        content = message;
    } else {
        content = message.content;
    }
    messages.push({ role: 'assistant', content });
}

// Same as 10c/10d's chat(), extended to match the lesson's own chat() growing a system/
// temperature/stopSequences signature. Not exercised by this file's demo yet — nothing
// here passes a system prompt or custom temperature — but included so chat() matches the
// lesson's shape rather than only what today's two questions happen to need. `tools` and
// `system` are only added to the request if actually provided, same as the lesson's
// `if tools:` / `if system:` guards.
async function chat(tools, { system, temperature = 1.0, stopSequences = [] } = {}) {
    const params = {
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1000,
        messages,
        temperature,
        stop_sequences: stopSequences,
    };

    if (tools) {
        params.tools = tools;
    }

    if (system) {
        params.system = system;
    }

    const response = await client.messages.create(params);
    return response;
}

// Pulls the readable answer out of a full response object — useful now that chat()
// returns the whole message instead of just the text, so callers that only want to show
// something to the user still have an easy way to get it.
function textFromMessage(message) {
    return message.content
        .filter((block) => block.type === 'text')
        .map((block) => block.text)
        .join('\n');
}

// Same block-shape logging as 10b/10c/10d, printed once per loop iteration below so each
// tool Claude reaches for is visible as it happens.
function logContentBlocks(response) {
    console.log(`stop_reason: ${response.stop_reason}`);
    for (const block of response.content) {
        if (block.type === 'text') {
            console.log(`  [text] ${block.text}`);
        } else if (block.type === 'tool_use') {
            console.log(`  [tool_use] id=${block.id} name=${block.name} input=${JSON.stringify(block.input)}`);
        } else {
            console.log(`  [${block.type}]`, block);
        }
    }
}

// The loop: keep calling Claude and running whatever tools it asks for, as many times as
// it takes, until it replies with stop_reason "end_turn" instead of "tool_use".
async function runConversation(userInput) {
    addUserMessage(userInput);

    while (true) {
        const response = await chat(TOOLS);
        logContentBlocks(response);
        addAssistantMessage(response);

        // Print every turn's text as it happens, not just the final one — a response can
        // have text ("I'll find out what day it is 103 days from today.") alongside a
        // tool_use block, and that text would otherwise only ever show up buried inside
        // logContentBlocks's debug output, never as something a real user actually sees.
        const text = textFromMessage(response);
        if (text) {
            console.log(`Claude: ${text}`);
        }

        if (response.stop_reason !== 'tool_use') {
            return text;
        }

        const toolUseBlocks = response.content.filter((block) => block.type === 'tool_use');
        const toolResultBlocks = toolUseBlocks.map(runTool);
        addUserMessage(toolResultBlocks);
    }
}

// Needs both tools, in sequence: Claude can't add a duration to "today" until it knows
// what today is, so this takes two loop iterations (get_current_datetime, then
// add_duration_to_datetime) before Claude has enough to answer. runConversation already
// prints each turn's text as it happens, so no need to print the returned answer again.
console.log('--- multi-tool question (needs both tools, in sequence) ---');
await runConversation('What day is 103 days from today?');
console.log();
