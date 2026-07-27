# Multi-turn conversations

## Theory

The Messages API is stateless (see [00 — the Messages API](../00-hello-claude/messages-api.md)):
Claude holds no memory between calls, so a "conversation" only exists because
the client keeps resending the growing list of past turns on every request.
This exercise is the first one that actually does that — a loop that reads a
line of input, calls the API with the _entire_ history so far, prints the
reply, and appends both the user's message and Claude's reply to that history
before looping again.

Builds on [01 — reading user input](../01-user-input/reading-user-input.md) by
replacing the single one-shot API call with a loop, and turning `content`
from a single string into an accumulating `messages` array.

## The `messages` array as the conversation

```js
const messages = [];

messages.push({ role: 'user', content: userInput });

const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages,
});

messages.push({ role: 'assistant', content: assistantText });
```

- `messages` is mutated in place across loop iterations — each call sends the
  full transcript, not just the newest line.
- Roles must alternate `user` / `assistant`. Skipping the assistant push (or
  pushing it before extracting `assistantText`) breaks that alternation and
  the next call will be rejected or behave oddly.
- Context grows unbounded with this approach — every turn resends everything
  before it, so token usage (and cost/latency) increases as the conversation
  gets longer. Real apps eventually need to trim, summarize, or cap history;
  out of scope for this exercise.

## Loop shape

`while (true)` + an explicit exit condition (`userInput.toLowerCase() ===
'exit'`) is the idiomatic JS equivalent of Python's same pattern — no
context manager or generator involved, just a loop that `break`s and then
closes the readline interface once.

## Model choice

Uses `claude-haiku-4-5-20251001` here instead of the project default
(`claude-opus-4-8`): this exercise is about the mechanics of the loop and
history array, not response quality, and Haiku keeps each turn fast during
manual back-and-forth testing.
