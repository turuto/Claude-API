// Steps 4-5 of the tool-use workflow: run the tool Claude asked for, send the result
// back as a tool_result block, and get Claude's final answer. Builds on 10c's helpers
// and its two demo questions — one that needs the tool, one that doesn't.
//
// Assumes a single tool_use block per response (find(), not filter()) — handling several
// at once is its own upcoming lesson, covered in a later exercise instead of here.

import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';

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

// Claude is stateless between requests — the only way it "remembers" earlier turns is
// that we resend the full message history with every call. This array grows each turn.
const messages = [];

// Same as 02b-conversation-claude — neither needed to change. They already just push
// whatever `content` they're given, so a content-block array works exactly like a plain
// string did before.
function addUserMessage(content) {
    messages.push({ role: 'user', content });
    console.log('USER: ', content);
}

function addAssistantMessage(content) {
    messages.push({ role: 'assistant', content });
    console.log('CLAUDE: ', content);
}

// Same as 02b's chat(), but now takes `tools` to forward to messages.create, and returns
// the whole response (not just response.content) — logContentBlocks below wants
// response.stop_reason too, which 02b never needed to look at.
async function chat(tools) {
    const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1000,
        messages,
        tools,
    });

    return response;
}

// Same as 10b/10c: prints each content block with enough detail to see the shape Claude
// actually sent — a `text` block has `.text`; a `tool_use` block has `.id`, `.name`, and
// `.input` (already a parsed object, not a JSON string).
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
// first question
addUserMessage('What is the exact current date and time?');
let dateResponse = await chat([getCurrentDatetimeSchema]);
console.log('--- date/time question ---');
logContentBlocks(dateResponse);
// Claude asking for a tool
addAssistantMessage(dateResponse.content);
// RUNNING THE TOOL
const toolUseBlock = dateResponse.content.find((block) => block.type === 'tool_use');
const result = getCurrentDatetime(toolUseBlock.input.date_format);
const toolResultBlock = {
    type: 'tool_result',
    tool_use_id: toolUseBlock.id,
    content: result,
    is_error: false,
};
// SENDING THE TOOL RESULT — content is always an array of blocks, even a single one.
addUserMessage([toolResultBlock]);
// GETTING CLAUDE ANSWER
dateResponse = await chat([getCurrentDatetimeSchema]);
addAssistantMessage(dateResponse.content);
