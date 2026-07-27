import 'dotenv/config';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import Anthropic from '@anthropic-ai/sdk';

// ANTHROPIC_API_KEY is already loaded into process.env by dotenv/config above.
const client = new Anthropic();

const messages = [];

async function main() {
    // Single readline instance reused for the entire session.
    const rl = createInterface({ input: stdin, output: stdout });

    while (true) {
        const userInput = await rl.question('You: ');
        if (userInput.toLowerCase() === 'exit') break;

        messages.push({ role: 'user', content: userInput });

        const response = await client.messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 1024,
            messages,
        });

        // response.content is always an array of content blocks; extract the text.
        const textBlock = response.content.find((b) => b.type === 'text');
        const assistantText = textBlock?.text ?? '';
        console.log(`\n🤖: ${assistantText}\n`);

        // Store the assistant reply so future turns have the full conversation history.
        messages.push({ role: 'assistant', content: assistantText });
    }

    rl.close();
}

main().catch(console.error);
