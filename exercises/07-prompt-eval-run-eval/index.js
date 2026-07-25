import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

function addUserMessage(messages, content) {
    messages.push({ role: 'user', content });
}

function addAssistantMessage(messages, content) {
    messages.push({ role: 'assistant', content });
}

async function chat(messages, { system, temperature = 1.0, stopSequences } = {}) {
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

// Merges a test case's task into the prompt template. No formatting instructions yet —
// deliberately bare, so Claude's output stays verbose until prompt iteration tightens it.
async function runPrompt(testCase) {
    const prompt = `Please solve the following task:\n\n${testCase.task}`;

    const messages = [];
    addUserMessage(messages, prompt);
    return chat(messages);
}

// Runs one test case through the prompt, then grades the output. The score is a
// hardcoded placeholder — proving the pipeline shape now, before grading logic exists.
async function runTestCase(testCase) {
    const output = await runPrompt(testCase);

    // TODO: grading
    const score = 10;

    return { output, testCase, score };
}

// Runs every test case in the dataset in turn and collects the graded results.
async function runEval(dataset) {
    const results = [];

    for (const testCase of dataset) {
        const result = await runTestCase(testCase);
        results.push(result);
    }

    return results;
}

const dataset = JSON.parse(await readFile(new URL('dataset.json', import.meta.url), 'utf8'));

const results = await runEval(dataset);

console.log(JSON.stringify(results, null, 2));
