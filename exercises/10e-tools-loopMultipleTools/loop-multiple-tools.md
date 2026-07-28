# The multi-turn tool loop

## Matches the lesson's "Tool Use Improvements" checklist

The lesson frames this step as four improvements over `10d`, all present in
`index.js`:

- **`add_user_message`/`add_assistant_message` handle multiple message
  blocks** — `addUserMessage`/`addAssistantMessage` accept a string, a
  content-block array, or a full API response object.
- **`chat` accepts a list of tools and returns the full message, not
  text** — `chat(tools, options)` forwards `tools` to `messages.create` and
  returns the whole `response`. It also picks up the lesson's `system`/
  `temperature`/`stopSequences` options (only added to the request if
  actually provided, matching the lesson's `if tools:`/`if system:`
  guards), even though this file's demo doesn't exercise them yet — `chat`
  is shaped to match where the lesson takes it, not just today's two
  questions.
- **A `text_from_message` function extracts all text blocks from a
  message** — `textFromMessage`.
- **Support for multiple tool calls in a conversation** — the `while` loop
  in `runConversation` keeps going across turns, and
  `toolUseBlocks.filter(...).map(runTool)` also covers several `tool_use`
  blocks arriving in a single turn.

[[tool-results]] (in `10d`) handled exactly one tool_use → tool_result round
trip and stopped. That's not enough once a question needs *more than one*
tool before Claude has enough to answer — "What day is 103 days from
today?" needs `get_current_datetime` first, then `add_duration_to_datetime`
with that result, and Claude can't ask for the second until it has the
first's answer. This exercise replaces the fixed two-step flow with a loop
that keeps going as long as Claude keeps asking for tools:

```js
while (true) {
    const response = await chat(TOOLS);
    addAssistantMessage(response);

    if (response.stop_reason !== 'tool_use') {
        return textFromMessage(response);
    }

    const toolResultBlocks = response.content.filter((b) => b.type === 'tool_use').map(runTool);
    addUserMessage(toolResultBlocks);
}
```

`textFromMessage` is called on **every** iteration, not just the one that
ends the loop — a response can carry text alongside a `tool_use` block
("I'll find out what day it is 103 days from today."), and that's exactly
the kind of running commentary a real user would expect to see, not
something that should only exist in debug output. Calling it just once, on
the final response, would silently drop every intermediate remark.

`response.stop_reason` is the loop condition — `"tool_use"` means run
whatever's in this response and go again; anything else means Claude is
done and it's time to return the answer.

## Why `addUserMessage`/`addAssistantMessage` needed to change again

Up through `10d`, both helpers only ever received something already
shaped as `content` — a string, or a content-block array. `runConversation`
wants to write `addAssistantMessage(response)` directly, passing the whole
API response object Claude returned, not `response.content`. Both helpers
now accept either shape and unwrap accordingly:

```js
function addAssistantMessage(message) {
    const content = typeof message === 'string' || Array.isArray(message) ? message : message.content;
    messages.push({ role: 'assistant', content });
}
```

This is the JS translation of the lesson's Python `isinstance(message, Message)`
check — JS has no equivalent runtime type for the SDK's response shape (it's
a plain object, not a class you can `instanceof` against), so the check
here is structural instead: "is this already content (string/array), or is
it something with a `.content` property to pull out?"

## `textFromMessage`: extracting text once `chat()` returns everything

`chat()` returning the full response (since `10c`) means the caller has to
pull the readable answer out themselves when they just want to show
something to a user — `textFromMessage` does that, joining every `text`
block's `.text` in case a response has more than one (e.g. a block
explaining what Claude's about to do, followed by more text after a tool
result).

## Two tools, one dispatch table, mismatched naming fixed

Bringing in `add_duration_to_datetime` from `10z-tools-add-duration`
surfaced a naming inconsistency: `10z` predates the convention (established
in `10a`) that a tool's `input_schema` properties should be snake_case to
match the wire format, and used camelCase (`datetimeStr`, `inputFormat`)
instead. With two tool schemas sitting in the same file, that mismatch
would be distracting, so this exercise's copy of the schema uses
`datetime_str`/`input_format` like `get_current_datetime` does — only the
schema changed; `addDurationToDatetime`'s own JS parameters stay camelCase.
`TOOL_FUNCTIONS` is where that translation happens, one entry per tool:

```js
const TOOL_FUNCTIONS = {
    get_current_datetime: (input) => getCurrentDatetime(input.date_format),
    add_duration_to_datetime: (input) =>
        addDurationToDatetime({
            datetimeStr: input.datetime_str,
            duration: input.duration,
            unit: input.unit,
            inputFormat: input.input_format,
        }),
};
```

This is also the first exercise where dispatch genuinely needs a lookup
table rather than a single hardcoded call — `10d` only ever had one tool to
run.

## `is_error` finally does something

`get_current_datetime` can't fail, so `10d`'s `is_error` was always
`false`. `add_duration_to_datetime` can — an unparseable `datetime_str` or
an unsupported `unit` throws — so `runTool` now wraps the call in a
`try`/`catch` and sets `is_error: true` with the error message as `content`
when that happens, which is what actually tells Claude the call didn't
succeed rather than treating the error text as a normal result.
