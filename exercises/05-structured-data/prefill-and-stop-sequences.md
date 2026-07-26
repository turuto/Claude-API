# Structured data via prefill + stop sequences

## The problem

Ask Claude for raw JSON or CSV and, by default, it wraps the answer in a
markdown code fence and adds explanatory text around it:

````
Here's the EventBridge rule you asked for:

```json
{ ... }
```

This rule triggers on EC2 state changes.
````

Great for a chat UI, useless if your code wants to `JSON.parse()` the
response directly — you'd have to strip the fence and the prose first.

## The technique: prefill the fence open, stop it closed

````js
const messages = [];
addUserMessage(messages, 'Generate a very short event bridge rule as json');
addAssistantMessage(messages, '```json');

const text = await chat(messages, ['```']);
````

- The user turn states the request as normal.
- The **assistant** turn is prefilled with ` ```json ` — an opening code
  fence with no closing one. Claude continues generation from wherever the
  conversation left off, so it treats the fence as already open and just
  writes the JSON body next, without a leading explanation.
- `stop_sequences: ['```']` ends generation the instant Claude tries to
  close the fence, which is also right after the content ends. The response
  text is the code-block content and nothing else.

Swapping the fence tag (` ```json ` vs ` ```csv `) is enough to steer the
same technique at a different format — the stop sequence stays ` ``` ` in
both cases, since that's the token that closes any fenced block.

## Model support: this is a legacy technique, not the current one

Assistant message **prefill** — ending the `messages` array on an
`assistant` turn instead of a `user` turn — has been removed on every
current-generation model: `claude-opus-4-8`, the rest of the Opus 4.6+
line, `claude-sonnet-5`, and `claude-fable-5` all reject it with a 400
(`"This model does not support assistant message prefill"`). This is why
this exercise runs on `claude-haiku-4-5` instead of the project's usual
default model — it's one of the few models still old enough to accept a
prefilled assistant turn.

Anthropic's own migration guidance points at the replacement for anything
built against a current model: **structured outputs**
(`output_config.format` with a JSON schema, or `strict: true` tool
definitions) for JSON, and plain system-prompt instructions
("respond with only X, no commentary") for other formats. See the
`claude-api` skill's model migration notes for the exact parameter shape.
Treat this exercise as the classic technique from the course, not as
something to reach for in new code targeting `claude-opus-4-8`.

## Parsing the response

`stop_sequences` still leaves a leading newline in `text`, from right after
the prefilled fence tag — `.trim()` before parsing:

```js
const jsonText = text.trim();
const parsed = JSON.parse(jsonText);
```

CSV has no equivalent parse step in the standard library; a naive
`line.split(',')` is enough to prove the response is clean rows with no
surrounding prose, though it won't handle quoted fields containing commas.

## Seeing the problem the technique solves

The commented-out block in `index.js` sends the same user message with no
prefill and no stop sequence, so you can compare Claude's default
(fenced-and-explained) response against the clean one, and confirm what
stripping logic you'd need if you weren't using this technique at all.
