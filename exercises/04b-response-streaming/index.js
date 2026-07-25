import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

const messages = [];

function addUserMessage(content) {
    messages.push({ role: 'user', content });
}

addUserMessage('Write a 1 sentence description of a fake database.');

const stream = client.messages.stream({
    model: 'claude-opus-4-8',
    max_tokens: 1000,
    messages,
});

// Equivalent to the Python lesson's `for text in stream.text_stream:` — the
// SDK already filters the raw event stream down to just text chunks here,
// the same way `text_stream` does in Python (see the notes for why this,
// not a hand-rolled iterator, is the right translation).
stream.on('text', (textDelta) => {
    process.stdout.write(textDelta);
});

// Equivalent to the Python lesson's stream.get_final_message() — the same
// Message shape a non-streaming call would return, e.g. for saving to a database.
const finalMessage = await stream.finalMessage();
console.log('\n\nStop reason:', finalMessage.stop_reason);
