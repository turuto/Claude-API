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

// `messages` is now a parameter instead of a shared closure variable — this exercise
// needs a fresh array per dataset generation run, not one growing conversation.
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

const DATASET_PROMPT = `Generate an evaluation dataset for a prompt evaluation. The dataset will be used
to evaluate prompts that generate Python, JSON, or Regex specifically for AWS-related tasks. Generate an
array of JSON objects, each representing a task that requires Python, JSON, or a Regex to complete.

Example output:
\`\`\`json
[
  {
    "task": "Description of task"
  },
  ...additional
]
\`\`\`

* Focus on tasks that can be solved by writing a single Python function, a single JSON object, or a single regex
* Focus on tasks that do not require writing much code

Please generate 3 objects.`;

// Generating test data is itself a Claude call, but not the one under evaluation — a
// fast/cheap model (Haiku) is the right pick, since only the eval subject's own prompt
// needs the strongest model. The prefill/stop-sequence combo (see 05-structured-data)
// keeps the reply to just the JSON array, ready for JSON.parse.
async function generateDataset() {
    const messages = [];
    addUserMessage(messages, DATASET_PROMPT);
    addAssistantMessage(messages, '```json');

    const text = await chat(messages, { stopSequences: ['```'] });

    return JSON.parse(text);
}

const dataset = await generateDataset();
console.log(dataset);

// Written next to this script, same as the lesson's dataset.json living beside the notebook.
await writeFile(new URL('dataset.json', import.meta.url), JSON.stringify(dataset, null, 2));
console.log('\nSaved to dataset.json');
