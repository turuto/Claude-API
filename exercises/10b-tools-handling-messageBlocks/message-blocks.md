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

This is still only steps 1–3 of [[tool-use-and-schemas]]'s 5-step
breakdown (write the function, write the schema, call Claude with it).
Steps 4–5 — actually running `get_current_datetime` and sending its result
back as a `tool_result` block so Claude can finish answering — are next.
