import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

export function addUserMessage(messages, content) {
    messages.push({ role: 'user', content });
}

export function addAssistantMessage(messages, content) {
    messages.push({ role: 'assistant', content });
}

// Sends a message to Claude and returns its reply as plain text.
export async function chat(messages, { system, temperature = 1.0, stopSequences } = {}) {
    const params = {
        model: 'claude-haiku-4-5-20251001',
        // How long a reply Claude is allowed to give. Detailed prompts can produce long
        // replies, so this leaves enough room that the reply doesn't get cut off partway.
        max_tokens: 2000,
        messages,
        temperature,
    };

    if (system) {
        params.system = system;
    }
    if (stopSequences?.length) {
        params.stop_sequences = stopSequences;
    }

    const response = await client.messages.create(params);

    return response.content
        .filter((block) => block.type === 'text')
        .map((block) => block.text)
        .join('\n');
}
