import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';

// ANTHROPIC_API_KEY is already loaded into process.env by dotenv/config above.
const client = new Anthropic();

// Single request/response call to the Messages API — no history, no streaming.
const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [
        {
            role: 'user',
            content: "In one sentence, say hello and confirm you're working.",
        },
    ],
});

// response.content is an array of blocks (text, tool_use, etc.) — pull out the text ones.
console.log(response);

for (const block of response.content) {
    if (block.type === 'text') {
        console.log(block.text);
    }
}
