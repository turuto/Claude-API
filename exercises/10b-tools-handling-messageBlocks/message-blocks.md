# Reading message content blocks

Once `tools` is passed to `messages.create`, `response.content` is never
reliably "just a string" — it's an array of content blocks, and which
blocks show up depends on what Claude decided to do:

- `{ type: 'text', text: '...' }` — a normal answer.
- `{ type: 'tool_use', id, name, input }` — Claude wants to call a tool.
  `input` arrives as an already-parsed object (not a JSON string), so no
  `JSON.parse()` is needed to read it.

`response.stop_reason` tells you which case you're in before you even look
at the blocks: `"tool_use"` means at least one `tool_use` block is present
and Claude is waiting on a result; `"end_turn"` means it answered directly.
This exercise's two demo calls trigger each: asking for the current
date/time reaches for `get_current_datetime`, asking an unrelated math
question ignores the same available tool entirely — Claude only reaches for
a tool when it's actually relevant, not just because one's available.

Earlier exercises' `chat()` helpers returned `message.content[0].text`
directly, which only worked because they never passed `tools` and text was
always the sole block. That shortcut breaks here — a response can have a
`tool_use` block at index 0 with no text block at all — so this exercise
skips `addUserMessage`/`addAssistantMessage`/`chat` entirely and calls
`client.messages.create` directly (same manual style as `02-conversation`),
to make the block-shaped response impossible to paper over with a helper.
A tool-aware version of those helpers returns once the mechanics are
familiar.

## Multi-block responses: text *and* tool_use together

The two blocks aren't mutually exclusive — Claude can return **both** in the
same message: a text block explaining what it's about to do (e.g. "Let me
check the current time for you") immediately followed by a `tool_use` block
that actually requests the call. This project's two demo calls each happened
to come back single-block (pure `tool_use` or pure `text`), but that's a
property of what `claude-haiku-4-5` chose to do on these particular prompts,
not a guarantee — `logContentBlocks`'s `for` loop handles any number/order of
blocks for exactly this reason, rather than assuming block 0 is the whole
answer.

## `tools` offers a capability, it doesn't force its use

Passing `tools` doesn't mean Claude must call one — it defaults to
`tool_choice: {type: 'auto'}`, so Claude decides per-request whether a given
tool is actually relevant, same as it decides whether an ordinary sentence in
its answer is relevant. That's exactly what the two demo calls prove: the
same `[getCurrentDatetimeSchema]` array is passed both times, but the
date/time question gets a `tool_use` block back and the math question gets
plain `text` and `stop_reason: "end_turn"` — the tool being available didn't
make Claude reach for it when it wasn't useful. `tool_choice` can override
that default (`{type: 'tool', name: '...'}` to force a specific tool,
`{type: 'none'}` to disable calls entirely) — not used here, but worth
knowing it exists.

## Preserving full content for conversation history (preview)

Claude has no server-side memory of the conversation — every prior turn,
including tool blocks, has to be replayed in `messages` on the next call.
When a response contains a `tool_use` block, the assistant turn appended to
history must be the **entire** `response.content` array as-is —

```js
messages.push({ role: 'assistant', content: response.content });
```

— not just the extracted text, or the `tool_use` block (and the `id` Claude
needs to match it to its result) gets silently dropped and the next call
breaks. This is also why the current `addAssistantMessage` helper (which
assumes a single text string) can't be reused unmodified once tool calls are
in play — it needs to accept a full content-block array, not just a string.

This is still only steps 1–3 of [[tool-use-and-schemas]]'s 5-step
breakdown (write the function, write the schema, call Claude with it).
Steps 4–5 — actually running `get_current_datetime` and sending its result
back as a `tool_result` block so Claude can finish answering — are next.

## `block.name` and the function are only linked by convention — so far

Nothing in this exercise ever calls `getCurrentDatetime()`. Look closely and
the only things that happen with the tool are: describing it to Claude via
`getCurrentDatetimeSchema`, and printing whatever comes back. A `tool_use`
block's `name` is just the string `'get_current_datetime'` — the same label
used in the schema, but there's no framework wiring that string to the
actual `getCurrentDatetime` function. They're two independent identifiers
(one snake_case for the wire format, one camelCase for JS) that happen to
refer to the same concept, kept in sync by hand, not by any code that
enforces it.

Claude *asking* for a tool by name doesn't make it run — dispatching
`block.name` to the real function is a step this exercise stops short of.
That's exactly what `10c-tools-messageBlocks-utilFunctions` adds, with a
`TOOL_FUNCTIONS` lookup table keyed by that same snake_case name:

```js
const TOOL_FUNCTIONS = {
    get_current_datetime: (input) => getCurrentDatetime(input.date_format),
};
```

That's the first point in this arc where the schema's `name` string is used
at runtime to call code, rather than just being logged for a human to read.
