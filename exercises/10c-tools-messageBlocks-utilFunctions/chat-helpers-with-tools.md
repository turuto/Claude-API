# Bringing `chat()` helpers into a tool-enabled call

[[message-blocks]] (in `10b`) intentionally skipped
`addUserMessage`/`addAssistantMessage`/`chat` and called
`client.messages.create` by hand, to make the block-shaped response
impossible to paper over with a helper while learning it. This exercise is
the same two demo questions, but now routed through those helpers (brought
back from `02b-conversation-claude`) — a variation on `10b`, not a step
forward in the workflow. Still just steps 1-3: write the function, write
the schema, call Claude with it, read what comes back.

## What had to change, and what didn't

`addUserMessage` and `addAssistantMessage` didn't need any code changes:

```js
function addUserMessage(content) {
    messages.push({ role: 'user', content });
}
```

Both already just push whatever `content` they're given — a plain string
worked before, and an array of content blocks (`dateResponse.content`, which
may contain a `tool_use` block) works exactly the same way, since neither
function ever assumed `content` was text.

`chat()` is what needed to grow, in two ways:

- It now takes a `tools` argument, to forward to `messages.create` — `02b`
  never passed `tools` at all.
- It returns the **whole** `response`, not just `response.content`.
  `logContentBlocks` (carried over from `10b`) needs `response.stop_reason`
  to report which case happened, and `02b` never had a reason to look at
  that field.

## Two independent questions, not a conversation

`messages.length = 0` between the two demo calls resets history on purpose
— this mirrors `10b`'s two separate `dateMessages`/`mathMessages` arrays.
The point of both exercises is to compare Claude's behavior on two
*unrelated* questions with the same tool available, not to build a real
back-and-forth conversation.

## What this exercise still doesn't do

Claude asking for `get_current_datetime` here still doesn't cause it to run
— nothing calls the function, and no `tool_result` goes back. That's
deliberately left for a later exercise (steps 4-5 of the workflow: run the
tool, send its result back, let Claude finish answering).
