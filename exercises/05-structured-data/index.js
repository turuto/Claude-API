import 'dotenv/config';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

const rl = createInterface({ input: stdin, output: stdout });

function addUserMessage(messages, content) {
    messages.push({ role: 'user', content });
}

function addAssistantMessage(messages, content) {
    messages.push({ role: 'assistant', content });
}

// `chat` now takes its own `messages` array instead of closing over a shared one, and
// an optional `stopSequences` list — the prefill technique below needs to pass one,
// which earlier exercises never had a reason to do.
//
// Model note: assistant message prefill (ending `messages` on an `assistant` turn) was
// removed on claude-opus-4-8 and the rest of the current-generation family (Opus 4.6+,
// Sonnet 5, Fable 5) — the API returns a 400 ("This model does not support assistant
// message prefill"). This exercise is specifically about the prefill technique, so it
// uses claude-haiku-4-5, one of the few models that still accepts it.
async function chat(messages, stopSequences) {
    const params = {
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages,
    };

    if (stopSequences) {
        params.stop_sequences = stopSequences;
    }

    const response = await client.messages.create(params);

    return response.content
        .filter((block) => block.type === 'text')
        .map((block) => block.text)
        .join('\n');
}

// The markdown fence Claude naturally reaches for when asked for each format. Prefilling
// the assistant turn with the opening fence, then stopping generation at the closing
// fence, traps the reply to just the content between them.
const FORMATS = {
    json: {
        fence: '```json',
        parse: (text) => JSON.parse(text.trim()),
    },
    csv: {
        fence: '```csv',
        // Naive split — no quoted-comma/escaping support, just enough to prove the
        // response is clean rows with no surrounding prose.
        parse: (text) =>
            text
                .trim()
                .split('\n')
                .map((line) => line.split(',')),
    },
};

// Skips the separate format question when the description already names one (e.g.
// "a json with fake contact details") — only asks when it's actually ambiguous.
// Word boundaries (\b) avoid matching "json" inside an unrelated longer word.
async function resolveFormat(description) {
    const mentionedKey = Object.keys(FORMATS).find((key) => new RegExp(`\\b${key}\\b`, 'i').test(description));
    if (mentionedKey) {
        console.log(`(using format: ${mentionedKey})`);
        return FORMATS[mentionedKey];
    }

    const formatInput = await rl.question('Format (json/csv): ');
    return FORMATS[formatInput.trim().toLowerCase()];
}

console.log("Structured data generator — type 'exit' or 'quit' to stop.\n");

while (true) {
    const description = await rl.question('What should Claude generate? ');
    if (['exit', 'quit'].includes(description.trim().toLowerCase())) break;

    const format = await resolveFormat(description);
    if (!format) {
        console.log('Unknown format — choose "json" or "csv".\n');
        continue;
    }

    // Fresh array per request: the technique only needs the one user ask plus the
    // prefilled assistant turn, not accumulated history from earlier generations.
    const messages = [];
    addUserMessage(messages, description);
    addAssistantMessage(messages, format.fence);

    // --- Uncomment to compare against Claude's default, unprefilled response ---

    const rawMessages = [];
    addUserMessage(rawMessages, description);
    const rawText = await chat(rawMessages);
    console.log('\n--- default response (no prefill / stop sequence) ---');
    console.log(rawText);
    console.log('--- end default response ---\n');

    const text = await chat(messages, ['```']);

    console.log(`\n${text.trim()}\n`);

    try {
        console.log('Parsed:', format.parse(text));
    } catch (err) {
        console.log('Parsing failed:', err.message);
    }
    console.log();
}

rl.close();
console.log('Goodbye!');
