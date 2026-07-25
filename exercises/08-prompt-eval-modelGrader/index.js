import 'dotenv/config';
import { writeFile } from 'node:fs/promises';
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

// Prefilled JSON replies aren't guaranteed to actually be valid JSON. This one is a
// recurring, not just occasional, failure mode: when a case discusses a regex pattern
// (e.g. in "weaknesses" or "reasoning"), Claude tends to quote it verbatim — backslashes
// and all — without doubling them for JSON, so retrying alone often reproduces the same
// break. Escaping any backslash JSON wouldn't accept as-is (leaving already-valid escapes
// like \" or \n untouched) fixes that class outright; the retry loop is a backstop for
// whatever else can go wrong at this external-API boundary.
function escapeStrayBackslashes(text) {
    return text.replace(/\\["\\/bfnrtu]|\\/g, (match) => (match.length === 2 ? match : '\\\\'));
}

async function chatJson(messages, chatOptions, retries = 2) {
    for (let attempt = 1; ; attempt++) {
        const text = await chat(messages, chatOptions);
        try {
            return JSON.parse(escapeStrayBackslashes(text));
        } catch (err) {
            if (attempt > retries) throw err;
        }
    }
}

// Same technique as 06-prompt-eval-dataset, plus a "solution_criteria" field per task —
// concrete, checkable criteria the model grader can hold each output up against, instead
// of judging quality with no reference point beyond the task description itself.
const DATASET_PROMPT = `Generate an evaluation dataset for a prompt evaluation. The dataset will be used
to evaluate prompts that generate Python, JSON, or Regex specifically for AWS-related tasks. Generate an
array of JSON objects, each representing a task that requires Python, JSON, or a Regex to complete.

Example output:
\`\`\`json
[
  {
    "task": "Description of task",
    "solution_criteria": "What a correct solution to this task must include"
  },
  ...additional
]
\`\`\`

* Focus on tasks that can be solved by writing a single Python function, a single JSON object, or a single regex
* Focus on tasks that do not require writing much code
* "solution_criteria" should be concrete and checkable, not vague praise like "well-written"

Please generate 3 objects.`;

async function generateDataset() {
    const messages = [];
    addUserMessage(messages, DATASET_PROMPT);
    addAssistantMessage(messages, '```json');

    return chatJson(messages, { stopSequences: ['```'] });
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

Task:
<task>
${testCase.task}
</task>

Solution to Evaluate:
<solution>
${output}
</solution>

Criteria you should use to evaluate the solution:
<criteria>
${testCase.solution_criteria}
</criteria>

Provide your evaluation as a structured JSON object with:
- "strengths": An array of 1-3 key strengths
- "weaknesses": An array of 1-3 key areas for improvement
- "reasoning": A concise explanation of your assessment
- "score": A number between 1-10`;

    const messages = [];
    addUserMessage(messages, evalPrompt);
    addAssistantMessage(messages, '```json');

    return chatJson(messages, { stopSequences: ['```'] });
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

const dataset = await generateDataset();
await writeFile(new URL('dataset.json', import.meta.url), JSON.stringify(dataset, null, 2));

const results = await runEval(dataset);

console.log(JSON.stringify(results, null, 2));
