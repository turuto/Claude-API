# Streaming tool use

## The new event: tool input arriving incrementally

`04b-response-streaming` covered `stream.on('text', ...)` for regular text
deltas. When a streamed request also has `tools`, Claude can stream a
tool call's *arguments* the same way — the SDK exposes this as the
`inputJson` event:

```js
stream.on('inputJson', (partialJson, jsonSnapshot) => {
    // partialJson  - the chunk of JSON just received
    // jsonSnapshot - the cumulative object parsed from all chunks so far
});
```

This is the JS SDK's equivalent of the Python lesson's raw
`InputJsonEvent` (`chunk.partial_json` / `chunk.snapshot`) — same two
pieces of data, delivered as event-emitter arguments instead of a chunk
object you switch on.

## Why the JSON arrives in bursts, not steadily

Unlike text, which streams token by token, `inputJson` chunks don't
arrive at a steady pace. The API buffers everything for a tool call's
current top-level key, validates that key's value against the tool's
`input_schema`, and only *then* releases the buffered chunks for it in
one burst. So for `save_article`'s schema (`abstract`, then a `meta`
object with `word_count`/`review`), you see: silence — burst of
`abstract` — silence — burst of `meta`. Both a top-level string
(`abstract`) and a top-level object (`meta`) are held back the same
way — the whole key-value pair, not just scalars.

That means, with plain (non-fine-grained) streaming, the JSON handed to
`inputJson` is always a valid partial JSON string — the API has already
schema-checked each key before sending it. That's also why there's no
`try/catch` around parsing here.

## Detecting when a tool call starts

There's no dedicated high-level event for "a tool_use block just
started" (only `contentBlock`, which fires once the block is *complete*
— by then all the JSON has already streamed through `inputJson`). To
print the tool's name as soon as Claude starts calling it, this
exercise reads the raw event stream directly:

```js
stream.on('streamEvent', (event) => {
    if (event.type === 'content_block_start' && event.content_block.type === 'tool_use') {
        // event.content_block.name is available here, before any input arrives
    }
});
```

This is the one place a raw SSE-shaped event is needed instead of the
SDK's convenience events — everything else (`text`, `inputJson`,
`finalMessage()`) stays at the high level.

## Fine-grained tool calling (not implemented here)

The lesson also covers *fine-grained tool calling*, enabled via a beta
header (`fine-grained-tool-streaming-2025-05-14`). It removes the
buffering described above entirely: chunks arrive as soon as Claude
generates them, with no per-key validation delay. The tradeoff is that
the JSON is no longer guaranteed valid — a value like `undefined` where
a number is expected can show up mid-stream, so `jsonSnapshot`/
`partialJson` would need a `try/catch` around `JSON.parse` instead of
being trusted as-is. This exercise sticks to the default (validated,
bursty) behavior; fine-grained is worth reaching for only when the
buffering delay is itself a UX problem.
