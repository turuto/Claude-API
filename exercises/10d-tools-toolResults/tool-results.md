# Steps 4-5: running the tool and sending the result back

[[chat-helpers-with-tools]] (in `10c`) stopped at reading the `tool_use`
block Claude sends back. This exercise finishes the round trip: run the
function Claude asked for, send its output back as a `tool_result` block,
and let Claude produce a final answer that uses it.

## Extracting the tool's arguments

A `tool_use` block's `input` is already a parsed object — `block.input` —
not a JSON string, so there's nothing to deserialize. Python's version of
this lesson unpacks that dict straight into keyword arguments
(`get_current_datetime(**response.content[1].input)`); JS has no
equivalent unpacking-into-named-parameters syntax, so `index.js` reads the
one property it needs directly off the object instead:

```js
getCurrentDatetime(toolUseBlock.input.date_format);
```

This scales fine for a function with one or two parameters. A tool with
many parameters would need either a matching number of destructured object
properties or a function rewritten to take a single options object — not
needed here since `getCurrentDatetime` only ever takes `date_format`.

## The tool_result block

The function's return value goes back to Claude as a `tool_result` block,
inside a **user**-role message:

- `tool_use_id` — must match the `id` of the `tool_use` block it's
  answering, so Claude can pair a result to its request.
- `content` — the tool's output, as a string.
- `is_error` — `true` if running the tool failed. `getCurrentDatetime`
  can't currently fail (it falls back to a default format instead of
  throwing), so this is always `false` here, but the property is still set
  explicitly since it's the mechanism a tool that *can* fail would use to
  tell Claude the call didn't succeed.

## Handling more than one tool_use block — deferred, not solved here

Claude can ask for multiple tools — or the same tool more than once — in a
single response (e.g. "what's 10+10 and what's 30+30?" against two
different tools), and there's a dedicated upcoming lesson on exactly that.
So `index.js` deliberately keeps `.find()` here rather than reaching for
`.filter()` + `.map()` early — this exercise assumes a single `tool_use`
block per response, and the multi-tool case gets its own exercise once
that lesson's been covered, rather than solving it ahead of time.

Even with `.find()`, the lesson's Python version hardcoding
`response.content[1]` (assuming block 0 is text and block 1 is `tool_use`)
isn't translated literally — `.find((block) => block.type === 'tool_use')`
locates it by type instead of position, which is what still makes the
follow-up multi-tool exercise a small change rather than a rewrite: only
the `find` → `filter`/`map` swap and wrapping the single result in an array
change, everything else about the round trip stays the same.

## The follow-up call still needs the tool schema

The request that sends the `tool_result` back still passes
`tools: [getCurrentDatetimeSchema]`, even though no further tool call is
expected — Claude needs the schema to make sense of the `tool_use`/
`tool_result` blocks already sitting in the conversation history. Dropping
`tools` on that second call is a common mistake the lesson calls out
explicitly.

## Message history after this exchange

By the time Claude gives its final answer, `messages` holds four entries:
user's question → assistant's `tool_use` → user's `tool_result` →
assistant's final `text` answer. All four have to be replayed on any
further turn in the same conversation, which is exactly what
`addUserMessage`/`addAssistantMessage` (unchanged since `10c`) keep doing.
