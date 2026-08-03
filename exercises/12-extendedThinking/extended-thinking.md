# Extended thinking

Extended thinking gives Claude a scratch pad to reason in before its final answer, returned
as separate `thinking` content blocks alongside the usual `text` block. It costs extra
(thinking tokens are billed) and adds latency, so the lesson's advice is: build the prompt
first, measure accuracy without thinking, and only turn it on if that's still not enough.

## `budget_tokens` vs adaptive — the lesson teaches a retired API

The lesson's `chat()` takes a fixed `thinking_budget` (default 1024) and sends:

```python
params["thinking"] = {"type": "enabled", "budget": thinking_budget}
```

That's the old fixed-token-budget model. On this project's default model, `claude-opus-4-8`,
it's rejected outright:

```
400 invalid_request_error: "thinking.type.enabled" is not supported for this model.
Use "thinking.type.adaptive" and "output_config.effort" to control thinking behavior.
```

So `index.js` uses adaptive thinking instead — Claude decides for itself when and how much to
think, and you tune overall depth with `effort` (`low`/`medium`/`high`/`xhigh`/`max`) rather
than a token count:

```js
thinking: { type: 'adaptive' },
output_config: { effort: 'high' },
```

`budget_tokens` still works on some older models (see below), but it's a dead end to build
new code around.

## `display`: why the thinking block can come back empty

Leaving `thinking` at just `{ type: 'adaptive' }`, opus-4-8 still returns a `thinking` block —
it just has an empty `.thinking` string:

```js
{ type: 'thinking', thinking: '', signature: 'Eq0...' }
```

That's the current default (`display: "omitted"`) — thinking happens and is billed the same
either way, it's just not shown. Add `display: 'summarized'` to get a readable recap instead:

```js
thinking: { type: 'adaptive', display: 'summarized' }
```

`index.js` always sets `summarized` when thinking is on, since an empty string isn't useful
for a learning exercise.

## Signature verification

Each `thinking` block carries a `signature` — the lesson's "cryptographic token that ensures
you haven't modified the thinking text," meant to stop a developer from editing Claude's
reasoning and feeding it back to steer the model somewhere unsafe. In practice, sending back
a `thinking` block with its `.thinking` text edited did **not** produce a 400 in testing here
— the request still succeeded. Don't rely on that as a guarantee either way; the safe rule is
simply what `addAssistantMessage` already does: push `response.content` through unchanged,
never reconstruct or edit a thinking block by hand.

## Redacted thinking — and why the demo uses a different model

Redacted thinking is what happens when Claude's own safety systems flag its reasoning: instead
of plain text, the block arrives as `{ type: 'redacted_thinking', data: '<encrypted>' }`. The
lesson's magic test string
(`ANTHROPIC_MAGIC_STRING_TRIGGER_REDACTED_THINKING_...`) is meant to force this for testing,
so your code has something concrete to not crash on.

Tried against `claude-opus-4-8` with adaptive thinking, the magic string does **not** trigger
it — Claude just answers with plain text, mildly suspicious of the string. Tried against
`claude-sonnet-4-5` with the old `{ type: 'enabled', budget_tokens: 1024 }` form, it does:

```js
{ type: 'redacted_thinking', data: 'EugDCpQBCBAYAipAfHf8qnA/dP653y...' }
```

That's why `demoRedactedThinking()` in `index.js` calls the API directly with a different
model instead of going through the shared `chat()` — this is a case where the lesson's
documented behavior only reproduces on an older thinking mode, not on adaptive thinking.

## Feature incompatibilities

The lesson flags message pre-filling and `temperature` as incompatible with extended
thinking. On `claude-opus-4-8` the second one is moot: `temperature` is rejected
unconditionally on this model now, thinking on or off —

```
400 invalid_request_error: `temperature` is deprecated for this model.
```

— which is why `chat()` here never sends it at all, unlike 09/10's versions that kept a
`temperature` passthrough.

## Interleaved thinking + tool use

Interleaved thinking — Claude reasoning again between tool calls in the same turn, not just
once up front — is what adaptive thinking gives you automatically; there's no separate flag
to turn on. It isn't exercised by this file (no tools are used here), but if you add tools to
a `thinking`-enabled `chat()` call, expect `thinking` blocks to show up interleaved with
`tool_use` blocks in `response.content`, and make sure whatever loop you write appends all of
them — not just the `tool_use` ones — back into `messages`.
