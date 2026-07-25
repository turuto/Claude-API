# Reading user input from the terminal

## Theory

So far the "conversation" with Claude has been entirely scripted — the
message content was a string baked into the source file, so every run
produced the same request. Real usage means the human decides what to say,
at the moment the program runs, not at the moment it was written.

Node scripts are normally non-interactive (they run and exit), so getting
live keyboard input requires explicitly reading from **stdin**, the same
stream a shell would pipe data into. This exercise is the smallest possible
step in that direction: pause the script, read one line of text the user
types, and use that instead of a literal string as the message content. The
call to the Messages API itself doesn't change at all — only _where the
content string comes from_ changes.

Builds on [00 — the Messages API](../00-hello-claude/messages-api.md) by
replacing the hardcoded prompt string with something typed at runtime.

## `node:readline/promises`

Built into Node, no extra dependency needed:

```js
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

const rl = createInterface({ input: stdin, output: stdout });
const prompt = await rl.question('You: ');
rl.close();
```

- `createInterface` wires up stdin/stdout for line-based reading.
- `.question(promptText)` prints `promptText`, waits for the user to type a
  line and press enter, and resolves with what they typed. Because it's the
  `readline/promises` variant (not the callback-based `node:readline`), it
  can be `await`ed directly instead of using a callback.
- `.close()` releases the interface once done reading — otherwise the
  process would hang open waiting for more input.

## Still single-turn

This exercise is still one request/response call — the user's typed text
just becomes the single message's `content` instead of a literal string.
There's no conversation history yet; each run starts fresh. That's the next
step (exercise 02: a real back-and-forth chat loop).
