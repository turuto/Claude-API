// Extended thinking gives Claude a "scratch pad" before its final answer. The lesson's
// chat() signature adds `thinking` (bool) and `thinking_budget` (a fixed token count) on top
// of 09/10's system/temperature/stopSequences/tools — but both of those are stale on current
// models. This project's default model, claude-opus-4-8, rejects the old
// `{ type: "enabled", budget_tokens: N }` form outright (400: "use thinking.type.adaptive and
// output_config.effort instead") and rejects `temperature` unconditionally, thinking or not.
// So `thinking` here is `{ type: "adaptive" }` and depth is tuned with `effort`, not a token
// count — see extended-thinking.md for what actually happens on the wire.

import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

const MODEL = 'claude-opus-4-8';

// For testing purposes, sending this exact string triggers a `redacted_thinking` block
// instead of readable reasoning — simulating what happens when Claude's internal safety
// systems flag its own thinking. It only actually triggers that on models that still use
// the old fixed-budget thinking (see demoRedactedThinking below); opus-4-8's adaptive
// thinking just answers it as an ordinary suspicious-looking prompt.
const REDACTED_THINKING_TEST_STRING =
    'ANTHROPIC_MAGIC_STRING_TRIGGER_REDACTED_THINKING_46C9A13E193C177646C7398A98432ECCCE4C1253D5E2D82641AC0E52CC2876CB';

// Same growing-history array as 10e/10f: Claude is stateless, so every turn resends
// everything, including any thinking blocks from earlier assistant turns.
const messages = [];

// Same shape as 10e/10f: accepts a string, an array of content blocks, or a full API
// response object (unwrapped via .content). Passing the full response through here is what
// keeps thinking blocks intact across turns — see "Signature verification" below.
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

// The lesson's chat(), minus `temperature` (rejected on this model) and `budget_tokens`
// (replaced by adaptive thinking + effort). `thinking` is a plain boolean here; when true we
// also set `display: "summarized"` so the thinking block actually carries readable text —
// left at its default, opus-4-8 still returns a thinking block, but its `.thinking` field is
// an empty string (see extended-thinking.md).
async function chat(tools, { system, stopSequences = [], thinking = false, effort } = {}) {
    const params = {
        model: MODEL,
        max_tokens: 2048,
        messages,
        stop_sequences: stopSequences,
    };

    if (thinking) {
        params.thinking = { type: 'adaptive', display: 'summarized' };
    }

    if (effort) {
        params.output_config = { effort };
    }

    if (tools) {
        params.tools = tools;
    }

    if (system) {
        params.system = system;
    }

    return client.messages.create(params);
}

function textFromMessage(message) {
    return message.content
        .filter((block) => block.type === 'text')
        .map((block) => block.text)
        .join('\n');
}

function thinkingFromMessage(message) {
    return message.content
        .filter((block) => block.type === 'thinking')
        .map((block) => block.thinking)
        .join('\n');
}

// A question simple enough to answer directly, but with a classic trick ("all but 9 die"
// means 9 survive, not 8) that adaptive thinking reliably catches and a quick guess doesn't.
const TRICK_QUESTION =
    'A farmer has 17 sheep, all but 9 die. Then he buys triple the number of remaining sheep. ' +
    'How many sheep does he have now?';

// --- Demo 1: the same question, thinking off vs on -------------------------------------

console.log('=== Same question, thinking off vs on ===\n');

messages.length = 0;
addUserMessage(TRICK_QUESTION);
const withoutThinking = await chat(undefined, { thinking: false });
addAssistantMessage(withoutThinking);
console.log('Without thinking:');
console.log(textFromMessage(withoutThinking) + '\n');

messages.length = 0;
addUserMessage(TRICK_QUESTION);
const withThinking = await chat(undefined, { thinking: true, effort: 'high' });
addAssistantMessage(withThinking);
const thinkingText = thinkingFromMessage(withThinking);
if (thinkingText) {
    console.log('Thinking (summarized):');
    console.log(thinkingText + '\n');
}
console.log('With thinking:');
console.log(textFromMessage(withThinking) + '\n');

// --- Demo 2: continuing a conversation that used thinking -------------------------------
// Multi-turn correctness with thinking depends on resending the FULL response.content —
// thinking block included, byte-for-byte — on the next turn. Each thinking block carries a
// `signature`, a cryptographic token the API uses to verify you haven't edited Claude's
// reasoning before handing it back. addAssistantMessage already stores the full response
// object above, so this "just works" — nothing extra to do here.

console.log('=== Continuing the conversation (thinking block carried over automatically) ===\n');
addUserMessage('And if he then sold half of them, how many would be left?');
const followUp = await chat(undefined, { thinking: true, effort: 'high' });
addAssistantMessage(followUp);
console.log(textFromMessage(followUp) + '\n');

// --- Demo 3: redacted thinking -----------------------------------------------------------
// Redacted thinking is what happens when Claude's own safety systems flag its reasoning:
// instead of plain text, the block's content is encrypted. Your code still needs to handle
// it without crashing — you just can't read it. As found while building this exercise, the
// magic string above only actually produces a `redacted_thinking` block on a model that
// still uses the OLD fixed-budget thinking (budget_tokens) — opus-4-8's adaptive thinking
// doesn't reproduce this, so this demo deliberately calls the API directly against an older
// model instead of going through chat().
async function demoRedactedThinking() {
    console.log('=== Redacted thinking (older model, since opus-4-8 no longer triggers it) ===\n');

    const response = await client.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 2048,
        thinking: { type: 'enabled', budget_tokens: 1024 },
        messages: [{ role: 'user', content: REDACTED_THINKING_TEST_STRING }],
    });

    for (const block of response.content) {
        if (block.type === 'redacted_thinking') {
            // block.data is encrypted — there's nothing to read, but the block is still
            // valid to hand back unchanged in a later turn to preserve full context.
            console.log(`Redacted thinking block received (${block.data.length} chars of encrypted data).`);
        } else if (block.type === 'text') {
            console.log('Text:', block.text);
        }
    }
}

await demoRedactedThinking();
