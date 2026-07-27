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
        // Elaborate prompts (long guidelines, multi-section few-shot examples) push
        // responses well past 1000 tokens — a response cut off mid-answer can be missing a
        // mandatory section entirely, which reads as a content failure but is really just
        // truncation. 2000 gives enough headroom for a full multi-section meal plan.
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
