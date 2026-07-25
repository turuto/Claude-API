import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

const messages = [];

function addUserMessage(content) {
    messages.push({ role: 'user', content });
}

addUserMessage('Write a 1 sentence description of a fake database.');

// client.messages.stream(...) is the SDK's streaming helper: it sends
// stream: true under the hood and returns a MessageStream, which is both an
// async iterable of raw server-sent events (like Python's `for event in
// stream`) and an event emitter with higher-level events (e.g. 'text') for
// just the incremental text deltas.
const stream = client.messages.stream({
    model: 'claude-opus-4-8',
    max_tokens: 1000,
    messages,
});

// Print each chunk of text as it arrives, with no trailing newline, so the
// response visibly builds up in the terminal instead of appearing all at once.
stream.on('text', (textDelta) => {
    process.stdout.write(textDelta);
});

stream.on('streamEvent', (event) => {
    console.log(event.type);
});

// finalMessage() resolves once the stream has fully ended, giving back the
// same shape of Message object a non-streaming client.messages.create() call
// would return.
const finalMessage = await stream.finalMessage();
console.log('\n\nStop reason:', finalMessage.stop_reason);
