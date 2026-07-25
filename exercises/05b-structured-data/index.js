import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

const messages = [];

function addUserMessage(content) {
    messages.push({ role: 'user', content });
}

function addAssistantMessage(content) {
    messages.push({ role: 'assistant', content });
}

addUserMessage('Generate three different sample AWS CLI commands. Each should be very short.');

// Prefilling doesn't have to be a markdown fence character alone — it can be a whole
// sentence. Claude continues as if it already committed to "single block" and "no
// comments" itself, then keeps going right after the opened fence.
addAssistantMessage('Here are all the 3 samples in a single block and with no comments:\n ```bash');

// claude-haiku-4-5-20251001, not the project default: same prefill-support reason as
// 05-structured-data (claude-opus-4-8 rejects assistant message prefill outright).
async function chat(stopSequences) {
    const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 256,
        messages,
        stop_sequences: stopSequences,
    });

    return response.content
        .filter((block) => block.type === 'text')
        .map((block) => block.text)
        .join('\n');
}

// Stopping at "```" cuts generation the instant Claude tries to close the fence it
// opened in the prefill — the response is exactly the block content, nothing after it.
const text = await chat(['```']);

console.log(text);
