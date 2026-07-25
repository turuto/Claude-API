# Generating a test dataset for prompt evaluation

## The goal

Before you can tell whether a prompt is any good, you need inputs to run it
against. A custom eval starts with a **dataset**: an array of task
descriptions that get fed through the prompt under test one at a time, so
you can inspect how it does across a spread of cases instead of just eyeballing
one example.

This exercise only builds the dataset. Running the AWS-code prompt against
it and scoring the results is a later exercise.

## Using Claude to write the dataset instead of by hand

`generateDataset()` asks Claude for 3 short task descriptions — things
solvable with a single Python function, JSON object, or regex, all
AWS-flavored. It's a normal `chat()` call, not the prompt being evaluated:

````js
async function generateDataset() {
    const messages = [];
    addUserMessage(messages, DATASET_PROMPT);
    addAssistantMessage(messages, '```json');

    const text = await chat(messages, { stopSequences: ['```'] });

    return JSON.parse(text);
}
````

The prefill (` ```json `) + stop sequence (` ``` `) combo is the same
technique from
[05 — structured data](../05-structured-data/prefill-and-stop-sequences.md):
it traps the reply to exactly the JSON array, so `JSON.parse` works without
any stripping.

## Model choice: Haiku, not the project default

`chat()` here hardcodes `claude-haiku-4-5-20251001` rather than
`claude-opus-4-8`. Generating test _inputs_ isn't the thing being measured —
it doesn't need the strongest model, just a fast and cheap one. Save the
expensive model for the prompt actually under evaluation.

Haiku is also required for the prefill technique itself: current-generation
models (`claude-opus-4-8` included) reject an assistant-prefilled `messages`
array outright — see the model-support note in the 05 doc.

## `chat`'s new shape: options object, not positional args

Earlier exercises' `chat` took a fixed set of params (`stopSequences` alone
in 05). The lesson this exercise translates adds `system` and `temperature`
too — enough positional parameters that an options object reads better than
`chat(messages, system, temperature, stopSequences)`:

```js
async function chat(messages, { system, temperature = 1.0, stopSequences } = {}) {
```

The `= {}` default lets `chat(messages)` still work with no second argument
at all, matching Python's default-argument version (`system=None,
temperature=1.0, stop_sequences=[]`) without needing every caller to pass an
empty object explicitly.

## Saving the result

```js
await writeFile(new URL('dataset.json', import.meta.url), JSON.stringify(dataset, null, 2));
```

`import.meta.url` is the ESM replacement for `__dirname` — it resolves
`dataset.json` next to `index.js` regardless of which directory the script
is invoked from, the same way the Python lesson's `open('dataset.json', 'w')`
lands the file beside the notebook.
