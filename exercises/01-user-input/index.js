import 'dotenv/config';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import Anthropic from '@anthropic-ai/sdk';

// ANTHROPIC_API_KEY is already loaded into process.env by dotenv/config above.
const client = new Anthropic();

// Prompt the user in the terminal instead of hardcoding the message content.
const rl = createInterface({ input: stdin, output: stdout });
const prompt = await rl.question('You: ');
rl.close();

// Single request/response call to the Messages API — no history, no streaming.
const response = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
});

// response.content is an array of blocks (text, tool_use, etc.) — pull out the text ones.
for (const block of response.content) {
    if (block.type === 'text') {
        console.log(block.text);
    }
}
