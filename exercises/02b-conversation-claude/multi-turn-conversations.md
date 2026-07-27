# Multi-turn conversations

## Theory

Every call to the Messages API is stateless — Claude doesn't remember
anything from a previous request on its own. What makes a "conversation"
feel continuous is entirely client-side bookkeeping: each request sends the
**entire history** of messages so far, and Claude's reply is appended to
that history before the next request goes out. Forget to include a prior
turn, and Claude has no idea it happened.

Builds on [01 — reading user input](../01-user-input/reading-user-input.md)
by looping the read-prompt-respond step instead of running it once, and by
accumulating a `messages` array instead of sending a single message.

## The `messages` array as growing state

```js
const messages = [];

function addUserMessage(content) {
    messages.push({ role: 'user', content });
}

function addAssistantMessage(content) {
    messages.push({ role: 'assistant', content });
}

async function chat() {
    const response = await client.messages.create({
        model: 'claude-opus-4-8',
        max_tokens: 1024,
        messages,
    });

    return response.content;
}
```

- `addUserMessage` / `addAssistantMessage` name the two mutations that ever
  happen to the history, instead of leaving bare `messages.push(...)` calls
  scattered through the loop.
- `chat` names the one thing that ever happens with that history: send it
  all to the API and hand back the content blocks of the reply.
- The main loop then reads as the concept itself: add the user's turn, chat,
  add the assistant's turn — the bookkeeping is named rather than inlined.
- `addAssistantMessage` is called with the raw array of content blocks
  Claude returned (`response.content`), not just the extracted text. That's
  the same shape the API expects back on the next call, so round-tripping it
  as-is keeps things correct even if a future exercise adds blocks the
  simple text-only version here doesn't handle (e.g. `tool_use`).
- Because the array keeps growing, later requests get larger (and slower/
  more expensive) the longer the conversation runs. Real applications
  eventually need a strategy for trimming or summarizing old turns — not
  covered here.

## Loop instead of one-shot

Exercise 01 read one line and made one API call. This exercise wraps that in
a `while (true)` loop, reading another line after each response, and adding
a way out:

```js
if (['exit', 'quit'].includes(userInput.trim().toLowerCase())) {
    break;
}
```

The loop exits before the user's message is pushed to history or sent to
the API, so typing "exit" ends the program cleanly without an extra
round-trip.

## Still no persistence across runs

The `messages` array lives only in memory for the life of the process —
closing the program loses the conversation. Saving/restoring history across
runs (e.g. to a file) is a possible future exercise, not this one.
