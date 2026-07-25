# The Messages API

## Theory

Claude is accessed over HTTP as a **completion API**: you send a snapshot of
a conversation (a list of turns, each with a role and some content) and get
back one assistant turn in response. There's no persistent session on
Anthropic's servers, no login, no socket kept open between calls — the model
itself holds no memory of past requests. Every call is independent and stands
entirely on what you include in that one request. This is why, later on, a
multi-turn "conversation" is really just the client resending the growing
list of past turns each time, not something the server tracks for you.

The Messages API is the core endpoint for this: give it a model, a token
budget, and a list of messages, and it computes the next assistant turn.
Everything else in the SDK (streaming, tool use, structured output) is a
variation on this same request/response shape.

## Client setup

- `new Anthropic()` with no arguments reads `ANTHROPIC_API_KEY` from
  `process.env` automatically. `dotenv/config` must be imported first so the
  key from `.env` is loaded into `process.env` before the client is built.
- The key is never handled directly in exercise code — the SDK attaches it
  as an `x-api-key` header on every request under the hood.

## `client.messages.create(...)`

A single request/response call — no streaming, no conversation history.

- `model`: which Claude model handles the request.
- `max_tokens`: a _cap_ on generated tokens, not a target — the model can
  (and usually does) stop earlier.
- `messages`: an array of `{ role, content }` turns. The API is stateless —
  it only sees what's in this array, so a real conversation means resending
  the full history on every call (see exercise 02).

## Shape of the response

`response.content` is an **array of content blocks**, not a plain string —
because a reply can mix multiple block types (`text`, `tool_use`, `thinking`,
etc.) in one response. Hence the loop:

```js
for (const block of response.content) {
  if (block.type === "text") { ... }
}
```

Other useful fields on `response`, not used by this exercise but worth
knowing:

- `stop_reason`: why generation stopped (`"end_turn"`, `"max_tokens"`,
  `"tool_use"`, `"stop_sequence"`).
- `usage.input_tokens` / `usage.output_tokens`: token counts for
  billing/context tracking.
- `usage.cache_*`: prompt-caching stats (zero unless caching is configured).
