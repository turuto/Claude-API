# The core eval pipeline

## The shape of an eval

An eval is three layered functions, each doing one job:

```
runEval(dataset)
  → runTestCase(testCase)   // for each test case
      → runPrompt(testCase) // merge task into the prompt, call Claude
      → grade the output    // hardcoded for now
```

`runPrompt` knows nothing about grading. `runTestCase` knows nothing about
iterating a dataset. `runEval` knows nothing about prompts or grading — it
just loops. That separation is what makes grading (next exercise) a
drop-in change to `runTestCase` alone.

## `runPrompt`: merge task into prompt, call Claude

```js
async function runPrompt(testCase) {
    const prompt = `Please solve the following task:\n\n${testCase.task}`;

    const messages = [];
    addUserMessage(messages, prompt);
    return chat(messages);
}
```

The prompt template is intentionally bare — no formatting instructions, no
system prompt. That's why the output you'll see is verbose (explanations,
code fences, commentary): this is the baseline the course tightens up once
prompt iteration starts. Judging the prompt is the whole point of the eval
that comes later — it isn't something to fix here.

## `runTestCase`: run, then grade

```js
async function runTestCase(testCase) {
    const output = await runPrompt(testCase);

    // TODO: grading
    const score = 10;

    return { output, testCase, score };
}
```

`score` is hardcoded to prove the pipeline's _shape_ — that a result object
carrying `output`, `testCase`, and `score` flows all the way through — before
any actual grading logic exists. Real grading (code-based checks, model-based
grading) replaces just the `TODO` line; nothing else in the pipeline changes.

## `runEval`: loop over the dataset

```js
async function runEval(dataset) {
    const results = [];

    for (const testCase of dataset) {
        const result = await runTestCase(testCase);
        results.push(result);
    }

    return results;
}
```

A plain sequential `for...of` with `await` inside, not
`Promise.all(dataset.map(...))` — test cases run one at a time, matching the
lesson's own note that even Haiku takes ~30 seconds for a full dataset.
Running requests concurrently is a real optimization, but it's introduced
deliberately later rather than folded in here.

## Loading the dataset this exercise runs against

```js
const dataset = JSON.parse(await readFile(new URL('dataset.json', import.meta.url), 'utf8'));
```

`dataset.json` here is a copy of the file
[06 — prompt eval dataset](../06-prompt-eval-dataset/index.js) generates —
each exercise stays runnable on its own rather than reaching into a sibling
folder at runtime, so this folder carries its own copy of the input it needs.

## Reading the output

`console.log(JSON.stringify(results, null, 2))` prints the full array: one
object per test case, each with the (verbose, unformatted) model output, the
original test case, and the placeholder score. Skimming this output is what
motivates the next two things the course builds: a tighter prompt, and a
grader that turns that `10` into something meaningful.
