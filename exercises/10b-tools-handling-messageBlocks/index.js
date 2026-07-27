// Step 3 of the tool-use workflow: call Claude with the JSON schema from 10a, and see
// what comes back. Claude's reply is never a single string once tools are in play —
// response.content is an array of blocks, and this exercise is about reading that array
// correctly (text vs tool_use) rather than assuming block 0 is always text.
//
// Steps 4-5 (actually running the tool and sending its result back) are the next
// exercise — this one stops at inspecting what Claude asked for.

import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();
const model = 'claude-haiku-4-5-20251001';

function addUserMessage(messages, content) {
    messages.push({ role: 'user', content });
}

function addAssistantMessage(messages, content) {
    messages.push({ role: 'assistant', content });
}

// Returns the full response (not just text) — reading tool_use blocks needs more than
// message.content[0].text, which is all earlier exercises' chat() needed.
async function chat(messages, { tools } = {}) {
    const params = {
        model,
        max_tokens: 1000,
        messages,
    };
    if (tools) {
        params.tools = tools;
    }
    return client.messages.create(params);
}

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

// Prints each content block with enough detail to see the shape Claude actually sent —
// a `text` block has `.text`; a `tool_use` block has `.id`, `.name`, and `.input`
// (already a parsed object, not a JSON string — no JSON.parse needed here).
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

// A request that needs the tool: expect a tool_use block, no direct answer yet.
const dateMessages = [];
addUserMessage(dateMessages, 'What is the exact current date and time?');
const dateResponse = await chat(dateMessages, { tools: [getCurrentDatetimeSchema] });
console.log('--- date/time question ---');
logContentBlocks(dateResponse);

// A request that doesn't need the tool: same tools available, but expect a plain
// text block and stop_reason "end_turn" — Claude only reaches for tools when relevant.
const mathMessages = [];
addUserMessage(mathMessages, 'What is 12 * 7?');
const mathResponse = await chat(mathMessages, { tools: [getCurrentDatetimeSchema] });
console.log('\n--- unrelated question (same tools available) ---');
logContentBlocks(mathResponse);
