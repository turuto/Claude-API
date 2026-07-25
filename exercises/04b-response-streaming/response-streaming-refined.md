# Response streaming — refined (course) version

## Theory

This is a second translation of the same lesson, this time following the
course's more idiomatic Python version rather than the raw `for event in
stream: print(event)` sketch from [04](../04-response-streaming/response-streaming.md):

```python
with client.messages.stream(
    model=model,
    max_tokens=1000,
    messages=messages
) as stream:
    for text in stream.text_stream:
        # Send each chunk to your client
        pass

    final_message = stream.get_final_message()
```

Same underlying API call and same `messages`/`addUserMessage` setup as 04 —
this file is about the differences in how the *response* is consumed.

## Correction: this ended up being the same code as 04, and that's correct

The first draft of this exercise translated `for text in stream.text_stream`
literally, by hand-writing an async generator that wraps the raw event
stream and filters for `text_delta` chunks. That was the wrong instinct.

`text_stream` is simpler than raw event iteration in Python because it
hides the `event.type == 'content_block_delta' and delta.type ==
'text_delta'` check inside the SDK. In the JS SDK, `.on('text', (textDelta)
=> ...)` — already used in 04 — hides that exact same check. It **is** the
JS equivalent of `text_stream`, not the raw async-iterable.

So the correct translation of the "refined" Python version is just:

```js
stream.on('text', (textDelta) => {
    process.stdout.write(textDelta);
});

const finalMessage = await stream.finalMessage();
```

— which is the same core streaming code 04 already had. Writing a custom
generator to get a `for`-loop shape wasn't "more refined," it was reinventing
a convenience the SDK already provides, for the sake of matching Python's
syntax rather than its simplicity.

### Aside: how `text_stream` would look if you built it yourself

For understanding what `.on('text', ...)` is doing internally, here's the
hand-rolled version this exercise used at first — not needed in practice,
since the SDK already ships the equivalent:

```js
async function* textStream(messageStream) {
    for await (const event of messageStream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            yield event.delta.text;
        }
    }
}

for await (const text of textStream(stream)) {
    process.stdout.write(text);
}
```

## Remaining real differences from 04

With the text-consumption approach now matching 04, the only differences
left are minor:

- **No `with ... as stream:` context manager.** Python's `with` block closes
  the underlying HTTP stream on exit, including on exceptions raised while
  iterating. JS has no direct equivalent here — `client.messages.stream(...)`
  returns the `MessageStream` immediately, its connection is cleaned up on
  its own once the stream ends naturally, and `.abort()` is available for
  cancelling early instead of relying on scope exit.
- **`get_final_message()` is a Promise in JS.** Python calls it as a plain
  method after the `with` block finishes; JS's `finalMessage()` returns a
  `Promise`, so it's `await`ed: `const finalMessage = await
  stream.finalMessage();`. Same purpose either way — the full `Message`,
  useful for persisting the completed response once streaming is done.
