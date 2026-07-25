import 'dotenv/config';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

const rl = createInterface({ input: stdin, output: stdout });

const messages = [];

// The system prompt sets Claude's role/behavior for the whole conversation, separately
// from the user/assistant turns in `messages`. Passed on every request, never pushed
// into the history array itself.
const systemPrompt = `You are a Math Tutor.
Don't give final answers. Only give hints, and guide the user towards the solution
Never tell the user to use a calculator.
If he gets stuck, explain the next step.
Don't answer anything that is not related.`;

function addUserMessage(content) {
    messages.push({ role: 'user', content });
}

function addAssistantMessage(content) {
    messages.push({ role: 'assistant', content });
}

async function chat(systemPrompt) {
    const params = {
        model: 'claude-opus-4-8',
        max_tokens: 1024,
        messages,
    };

    // Only attach `system` when a prompt is actually provided, so `chat` still works
    // for callers that want the default, promptless behavior.
    if (systemPrompt) {
        params.system = systemPrompt;
    }
    const response = await client.messages.create(params);

    return response.content;
}

console.log("Chatting with Claude — type 'exit' or 'quit' to end the conversation.\n");

while (true) {
    const userInput = await rl.question('You: ');

    if (['exit', 'quit'].includes(userInput.trim().toLowerCase())) {
        break;
    }

    addUserMessage(userInput);

    const responseContent = await chat(systemPrompt);

    const replyText = responseContent
        .filter((block) => block.type === 'text')
        .map((block) => block.text)
        .join('\n');

    console.log(`Claude: ${replyText}\n`);

    addAssistantMessage(responseContent);
}

rl.close();
console.log('Goodbye!');
