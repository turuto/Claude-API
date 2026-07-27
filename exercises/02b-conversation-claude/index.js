import 'dotenv/config';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import Anthropic from '@anthropic-ai/sdk';

// ANTHROPIC_API_KEY is already loaded into process.env by dotenv/config above.
const client = new Anthropic();

// Reads one line of terminal input per turn, the same way exercise 01 did.
const rl = createInterface({ input: stdin, output: stdout });

// Claude is stateless between requests — the only way it "remembers" earlier turns is
// that we resend the full message history with every call. This array grows each turn.
const messages = [];

// The only two mutations the history ever undergoes: append a user turn, or an
// assistant turn. Naming them keeps the main loop free of bare messages.push calls.
function addUserMessage(content) {
    messages.push({ role: 'user', content });
}

function addAssistantMessage(content) {
    messages.push({ role: 'assistant', content });
}

// Sends the whole accumulated history to the Messages API and returns Claude's
// reply as its raw array of content blocks (text, tool_use, etc.).
async function chat() {
    const response = await client.messages.create({
        model: 'claude-opus-4-8',
        max_tokens: 1024,
        messages,
    });

    return response.content;
}

console.log("Chatting with Claude — type 'exit' or 'quit' to end the conversation.\n");

// Main chat loop: read a line, forward it (plus all prior history) to Claude, print
// the reply, repeat — until the user types an exit keyword.
while (true) {
    const userInput = await rl.question('You: ');

    if (['exit', 'quit'].includes(userInput.trim().toLowerCase())) {
        break;
    }

    addUserMessage(userInput);

    const responseContent = await chat();

    // responseContent is an array of blocks (text, tool_use, etc.) — pull out the text ones.
    // filter: drop non-text blocks (e.g. tool_use); map: unwrap the text string from each
    // remaining block; join: merge multiple text blocks with a newline between them.
    const replyText = responseContent
        .filter((block) => block.type === 'text')
        .map((block) => block.text)
        .join('\n');

    console.log(`Claude: ${replyText}\n`);

    // Record Claude's reply in the history so it's included as context on the next turn.
    addAssistantMessage(responseContent);
}

rl.close();
console.log('Goodbye!');
