# The `PromptEvaluator` class

The class discussed here lives in `partials/promptEvaluator.js`, not
`index.js` — see [file-organization.md](file-organization.md) for how this
exercise's code is split across `partials/`.

06-08 built the eval pipeline as three standalone functions
(`runPrompt`/`runTestCase`/`runEval`). This exercise's course lesson
packages the same idea as a class instead, `PromptEvaluator`, because it
now carries real configuration — `maxConcurrentTasks` — that every method
needs access to. A class is the right fit here specifically because of
that shared, constructor-supplied state; it's not a stylistic upgrade over
06-08's approach.

## Dataset generation is now two model calls, not one

06's `generateDataset()` asked for the whole dataset in a single JSON
array in one call. This class splits that into two steps:

- `generateUniqueIdeas(taskDescription, promptInputsSpec, numCases)` — one
  call that returns a JSON array of short scenario descriptions (e.g.
  "older athlete with a dairy allergy").
- `generateTestCase(taskDescription, idea, promptInputsSpec)` — one call
  _per idea_, expanding that short description into a full test case:
  concrete `prompt_inputs` values plus `solution_criteria`.

Splitting the "what should we test" decision from "flesh this one out in
detail" gets more diverse, deliberately-distinct scenarios than asking for
N complete test cases in one shot, where a model tends to produce
variations on a theme.

## Concurrency without threads

Python's `generate_dataset`/`run_evaluation` use
`concurrent.futures.ThreadPoolExecutor(max_workers=max_concurrent_tasks)`
to run several `generate_test_case`/`run_test_case` calls at once, capped
at a concurrency limit — necessary in Python because the work is I/O-bound
network calls, and necessary generally because too much concurrency trips
API rate limits.

Node has no thread pool for this — it doesn't need one, since
`client.messages.create` is already a non-blocking, single-threaded async
operation. The equivalent here is `mapWithConcurrency(items, limit, fn)`
(`partials/concurrency.js`):
a fixed number of "worker" loops (`Math.min(limit, items.length)` of them)
that each keep pulling the next unclaimed index off a shared counter until
the list is exhausted, running `fn` concurrently across all workers but
never more than `limit` at once:

```js
async function mapWithConcurrency(items, limit, fn) {
    const results = new Array(items.length);
    let nextIndex = 0;

    async function worker() {
        while (nextIndex < items.length) {
            const index = nextIndex++;
            results[index] = await fn(items[index], index);
        }
    }

    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));

    return results;
}
```

One behavioral difference from the Python version: this fills `results`
by original index, so output order always matches input order. Python's
`as_completed` yields whichever future finishes first, so its result order
depends on which API calls happened to return first. Neither is "more
correct" — deterministic ordering is a minor, intentional simplification
here since nothing in this pipeline depends on completion order.

## Progress logging without a thread pool's completion callback

`createProgressLogger(label, total)` returns a closure that increments a
counter each call and prints `"<label> N/total test cases"` only when
completion crosses a new 20% milestone — a direct translation of the
Python version's `milestone_percentage = (current_percentage // 20) * 20`
check, just re-expressed as a closure instead of loop-local variables,
since `mapWithConcurrency`'s workers call it from separate concurrent
callbacks rather than one shared loop body.

## The pipeline stays generateDataset → runEvaluation

```js
const dataset = await evaluator.generateDataset({ taskDescription, promptInputsSpec, outputFile, numCases });
await evaluator.runEvaluation({
    runPromptFunction: runPrompt,
    datasetFile,
    extraCriteria,
    jsonOutputFile,
    htmlOutputFile,
});
```

`runPrompt` is still the one function you actually iterate on when doing
prompt engineering (see
[iterative-prompt-engineering.md](iterative-prompt-engineering.md)) — the
evaluator itself doesn't change between iterations, only what you hand it
as `runPromptFunction`.

## Still reusing `chatJson`

All three model calls that expect JSON back (`generateUniqueIdeas`,
`generateTestCase`, `gradeOutput`) go through the same `chatJson` +
`escapeStrayBackslashes` helper (`partials/jsonUtils.js`), introduced in
[08's notes](../08-prompt-eval-modelGrader/model-grading.md#chatjson-prefilled-json-isnt-guaranteed-to-actually-be-valid-json).
Nothing new here — just three more call sites for the same fix.
