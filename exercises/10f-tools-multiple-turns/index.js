// The lesson's "Conversation with tools" pattern, wired into an actual back-and-forth
// session instead of one hardcoded question like 10e: an interactive readline loop (same
// shape as 02b-conversation-claude) where every line the user types becomes a full
// runConversation call — which itself may take Claude several tool round trips before it
// has an answer — and history keeps accumulating across ALL of those turns, tool calls
// included, not just within a single question.
//
// The lesson's pseudocode for this loop has what looks like a typo: it calls
// add_user_message(messages, response) right after chat(messages), but `response` is
// Claude's own reply — that has to be the ASSISTANT turn. addAssistantMessage is used here
// instead, matching what 10e already did.

import 'dotenv/config';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
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

// Same tool from 10e-tools-loopMultipleTools, duplicated here for the same reason.
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

// Runs the function a single tool_use block asked for, catching failures so is_error can
// tell Claude the call didn't succeed instead of treating the error message as a normal
// result.
function runSingleTool(toolUseBlock) {
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

    // this is a ToolResultBlock
    return {
        type: 'tool_result',
        tool_use_id: toolUseBlock.id,
        content,
        is_error: isError,
    };
}

// The lesson's run_tools: for each tool_use block Claude asked for, run it and collect its
// ToolResultBlock, then return all of them together for the next user turn.
function runTools(toolUseBlocks) {
    const toolResultBlocks = [];
    toolUseBlocks.forEach((toolUseBlock) => {
        toolResultBlocks.push(runSingleTool(toolUseBlock));
    });
    return toolResultBlocks;
}

// Claude is stateless between requests — the only way it "remembers" earlier turns is
// that we resend the full message history with every call. Unlike 10e's two independent
// demo questions, nothing resets this array here — it grows for the whole session, across
// every user turn AND every tool round trip inside each of those turns.
const messages = [];

// Same as 10e: accepts a string, an array of content blocks, or a full API response object.
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

// Same as 10e's chat(): tools/system are only added to the request if provided.
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

function textFromMessage(message) {
    return message.content
        .filter((block) => block.type === 'text')
        .map((block) => block.text)
        .join('\n');
}

// The lesson's run_conversation, unchanged in shape from 10e: keep calling Claude and
// running whatever tools it asks for until it replies with stop_reason "end_turn". Called
// once per user turn below, so ANY number of these loops can run back to back in one
// session, sharing the same growing `messages` history.
async function runConversation(userInput) {
    addUserMessage(userInput);

    while (true) {
        const response = await chat(TOOLS);
        addAssistantMessage(response);

        const text = textFromMessage(response);
        if (text) {
            console.log(`Claude: ${text}`);
        }

        // Claude doesn't need any more tools. safe to assume it has ended
        if (response.stop_reason !== 'tool_use') {
            return text;
        }

        const toolUseBlocks = response.content.filter((block) => block.type === 'tool_use');
        const toolResultBlocks = runTools(toolUseBlocks);
        addUserMessage(toolResultBlocks);
    }
}

// Reads one line of terminal input per turn, the same way 02b-conversation-claude did —
// but now every turn can trigger its own internal tool-use loop before Claude answers.
const rl = createInterface({ input: stdin, output: stdout });

console.log("Chatting with Claude — type 'exit' or 'quit' to end the conversation.\n");

while (true) {
    const userInput = await rl.question('You: ');

    if (['exit', 'quit'].includes(userInput.trim().toLowerCase())) {
        break;
    }

    await runConversation(userInput);
    console.log();
}

rl.close();
console.log('Goodbye!');
