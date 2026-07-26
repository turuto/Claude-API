# Response streaming

## Theory

Without streaming, `client.messages.create(...)` blocks until Claude has
generated the _entire_ reply, then hands it back as one `Message` object.
Streaming instead opens a connection where the server pushes small chunks
("events") as the response is generated, so you can start displaying text
before generation has finished.

Builds on [02 — multi-turn conversations](../02-conversation-claude/multi-turn-conversations.md):
same `messages` array and `addUserMessage` helper, but a single one-shot
call instead of a loop, and that call streams instead of blocking.

## `client.messages.stream(...)` vs `client.messages.create(...)`

`client.messages.stream(...)` is the SDK's dedicated streaming helper. It
sends `stream: true` to the API under the hood and returns a `MessageStream`
object rather than a `Promise<Message>`. That object is:

- an **async iterable** of the raw server-sent events (equivalent to the
  Python lesson's `for event in stream: print(event)`)
- an **event emitter** with higher-level, pre-filtered events layered on top
  of the raw ones (`'text'`, `'thinking'`, `'contentBlock'`, etc.)
- a source of promises like `.finalMessage()` / `.finalText()` that resolve
  once the stream ends, giving back the same shape of result a non-streaming
  call would.

## What a raw event stream actually looks like

Listening to every raw event (`stream.on('streamEvent', (event) => ...)`)
for the prompt "write a 1 sentence description of a fake database" prints
something like:

```
message_start
content_block_start
content_block_delta   { delta: { type: 'text_delta', text: 'The' } }
content_block_delta   { delta: { type: 'text_delta', text: ' NimbusVault...' } }
content_block_delta   { delta: { type: 'text_delta', text: ' database...' } }
content_block_stop
message_delta
message_stop
```

- `message_start` — the response begins; carries the initial (mostly empty)
  `Message` shell and input token usage.
- `content_block_start` — a new content block begins (index 0, 1, ...).
  Its type (`text`, `thinking`, `tool_use`, ...) is decided here.
- `content_block_delta` — the actual incremental payload for the current
  block. Its shape depends on what kind of block is streaming:
    - `text_delta` — a chunk of visible reply text
    - `thinking_delta` / `signature_delta` — extended-thinking output
    - `input_json_delta` — a chunk of a tool call's JSON arguments
    - `citations_delta` — a citation attached to text
- `content_block_stop` — the current block is complete.
- `message_delta` — top-level fields that only firm up at the end, like
  `stop_reason` and final `usage` counts.
- `message_stop` — the response is fully done.

A single response can have multiple `content_block_start` /
`..._delta` / `content_block_stop` cycles (e.g. a `thinking` block
followed by a `text` block, or several `tool_use` blocks), each at its own
`index`.

## Why filter with `.on('text', ...)` instead of reading raw events

`content_block_delta` isn't always text — it's whatever kind of block
happens to be streaming at that moment. To display just the visible reply,
you'd otherwise have to write this yourself on every `streamEvent`:

```js
if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
    process.stdout.write(event.delta.text);
}
```

`.on('text', (textDelta) => ...)` is the SDK doing exactly that filtering
internally and emitting a plain string. Reserve raw `streamEvent` listening
for when you actually need to see everything (debugging, learning, or
handling other block types like `tool_use`/`thinking`) — for "just show me
the reply as it's typed," `'text'` is the right tool.

## `finalMessage()`

`await stream.finalMessage()` resolves once the stream has fully ended
(after `message_stop`) with the same `Message` shape a non-streaming
`client.messages.create()` call would return — useful for reading final
fields like `stop_reason` or `usage` once the whole response is in.
