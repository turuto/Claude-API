import 'dotenv/config';
import { writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
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

// Same technique as 06-prompt-eval-dataset, plus a "format" field per task so the code
// grader below knows which validator to run against each response.
const DATASET_PROMPT = `Generate an evaluation dataset for a prompt evaluation. The dataset will be used
to evaluate prompts that generate Python, JSON, or Regex specifically for AWS-related tasks. Generate an
array of JSON objects, each representing a task that requires Python, JSON, or a Regex to complete.

Example output:
\`\`\`json
[
  {
    "task": "Description of task",
    "format": "python"
  },
  ...additional
]
\`\`\`

* Focus on tasks that can be solved by writing a single Python function, a single JSON object, or a single regex
* Focus on tasks that do not require writing much code
* "format" must be exactly one of "python", "json", or "regex", matching what the task asks for

Please generate 3 objects.`;

async function generateDataset() {
    const messages = [];
    addUserMessage(messages, DATASET_PROMPT);
    addAssistantMessage(messages, '```json');

    return chatJson(messages, { stopSequences: ['```'] });
}

// Tightened from 08's bare template: naming the exact output formats and banning
// commentary, then prefilling a generic (non-language-tagged) fence so Claude commits
// to "just the code" before writing a single token of it.
async function runPrompt(testCase) {
    const prompt = `Please solve the following task:

${testCase.task}

* Respond only with Python, JSON, or a plain Regex
* Do not add any comments or commentary or explanation`;

    const messages = [];
    addUserMessage(messages, prompt);
    addAssistantMessage(messages, '```code');

    return chat(messages, { stopSequences: ['```'] });
}

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

    return chatJson(messages, { stopSequences: ['```'] });
}

function validateJson(text) {
    try {
        JSON.parse(text.trim());
        return 10;
    } catch {
        return 0;
    }
}

// There's no JS equivalent of Python's ast.parse — the only thing that can actually
// tell whether a string is valid Python is Python's own parser, so this shells out to
// the system's python3 and checks whether it accepted the input.
function validatePython(text) {
    const result = spawnSync('python3', ['-c', 'import ast, sys; ast.parse(sys.stdin.read())'], {
        input: text.trim(),
    });

    return result.status === 0 ? 10 : 0;
}

function validateRegex(text) {
    try {
        new RegExp(text.trim());
        return 10;
    } catch {
        return 0;
    }
}

const SYNTAX_VALIDATORS = {
    python: validatePython,
    json: validateJson,
    regex: validateRegex,
};

// Format + syntax validity are cheap, deterministic checks — a model grader would be
// overkill for "does this parse." Task-following stays with gradeByModel, which is
// better suited to judging whether the code actually does what was asked.
function gradeSyntax(output, testCase) {
    const validate = SYNTAX_VALIDATORS[testCase.format];
    return validate(output);
}

// Equal-weight blend of "did it follow the task" (model) and "does it parse" (code).
async function runTestCase(testCase) {
    const output = await runPrompt(testCase);

    const modelGrade = await gradeByModel(testCase, output);
    const syntaxScore = gradeSyntax(output, testCase);
    const score = (modelGrade.score + syntaxScore) / 2;

    return { output, testCase, score, reasoning: modelGrade.reasoning };
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
