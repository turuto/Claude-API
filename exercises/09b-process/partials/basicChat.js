import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

export function addUserMessage(messages, content) {
    messages.push({ role: 'user', content });
}

export function addAssistantMessage(messages, content) {
    messages.push({ role: 'assistant', content });
}

export async function chat(messages, { system, temperature = 1.0, stopSequences } = {}) {
    const params = {
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1000,
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
