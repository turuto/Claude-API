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

async function runPrompt(testCase) {
    const prompt = `Please solve the following task:\n\n${testCase.task}`;

    const messages = [];
    addUserMessage(messages, prompt);
    return chat(messages);
}

// Asks Claude to review another Claude response — a second, independent call, not part
// of the pipeline under test. Requesting strengths/weaknesses/reasoning alongside the
// score keeps the model from defaulting to a lazy, noncommittal 6 for everything.
async function gradeByModel(testCase, output) {
    const evalPrompt = `You are an expert code reviewer. Evaluate this AI-generated solution.

Task: ${testCase.task}
Solution: ${output}

Provide your evaluation as a structured JSON object with:
- "strengths": An array of 1-3 key strengths
- "weaknesses": An array of 1-3 key areas for improvement
- "reasoning": A concise explanation of your assessment
- "score": A number between 1-10`;

    const messages = [];
    addUserMessage(messages, evalPrompt);
    addAssistantMessage(messages, '```json');

    const evalText = await chat(messages, { stopSequences: ['```'] });
    return JSON.parse(evalText);
}

// The hardcoded score: 10 placeholder from 07 is now real, model-assigned feedback.
async function runTestCase(testCase) {
    const output = await runPrompt(testCase);

    const modelGrade = await gradeByModel(testCase, output);

    return { output, testCase, score: modelGrade.score, reasoning: modelGrade.reasoning };
}

function average(numbers) {
    return numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
}

async function runEval(dataset) {
    const results = [];

    for (const testCase of dataset) {
        const result = await runTestCase(testCase);
        results.push(result);
    }

    console.log(`Average score: ${average(results.map((result) => result.score))}`);

    return results;
}

const dataset = JSON.parse(await readFile(new URL('dataset.json', import.meta.url), 'utf8'));

const results = await runEval(dataset);

console.log(JSON.stringify(results, null, 2));
