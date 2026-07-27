# Why this exercise has a `partials/` folder

Every other exercise in this project is a single `index.js` — appropriate
when the whole lesson fits in a couple hundred lines. This one doesn't:
between the `PromptEvaluator` class, three long prompt-template functions,
and a full HTML/CSS report generator, a single file stopped being
readable. `partials/` splits it by concern instead:

- `basicChat.js` — the client setup plus the `addUserMessage` /
  `addAssistantMessage` / `chat` trio used since 00-08.
- `jsonUtils.js` — `chatJson`, carrying forward the backslash-escaping fix
  from
  [08's notes](../08-prompt-eval-modelGrader/model-grading.md#chatjson-prefilled-json-isnt-guaranteed-to-actually-be-valid-json).
- `concurrency.js` — `mapWithConcurrency` and `createProgressLogger`, the
  async stand-in for Python's `ThreadPoolExecutor` (see
  [prompt-evaluator-class.md](prompt-evaluator-class.md#concurrency-without-threads)).
- `mathUtils.js` — just `average`; small enough to look trivial alone, but
  kept separate so it doesn't get lost inside a bigger file.
- `prompts.js` — the three prompt-building functions
  (`buildIdeasPrompt`/`buildTestCasePrompt`/`buildEvalPrompt`). These are
  mostly long, static template text — the actual prompt engineering
  content — and reading them shouldn't require scrolling past unrelated
  code.
- `report.js` — `generatePromptEvaluationReport`, the HTML/CSS report
  builder. Almost pure markup, nothing to do with the evaluation logic
  itself.
- `promptEvaluator.js` — the `PromptEvaluator` class, which composes all of
  the above.

Notice there's no `mealPlanPrompts.js` here, unlike
[09c-solution](../09c-solution). The naive prompt is the one thing in this
exercise you're actually meant to edit, so it's inlined directly in
`index.js`'s `runPrompt` instead of split into `partials/` — splitting it
out would only add a file to jump to for something with a single call
site. 09c-solution keeps its prompts in a partial because it has two
variants (naive and engineered) with two real consumers (`index.js` and
`compare-baseline.js`) — a genuine reuse case this exercise doesn't have.

`index.js` is left as just the part of the original notebook you're
actually meant to run repeatedly while doing prompt engineering:
instantiate the evaluator, generate a dataset, define `runPrompt`, run the
evaluation. This mirrors 002_prompting_completed.ipynb's own last few
cells — the class and its helpers are lesson infrastructure, `runPrompt`
in `index.js` is the exercise.

This is still a self-contained exercise folder, not a shared module across
exercises — `partials/` only exists inside `09a-prompt-engineering/` and
nothing outside this folder imports from it, matching every other
exercise's independence. [09b-process](../09b-process) and
[09c-solution](../09c-solution) are separate copies of this same code —
a working copy and an engineered-prompt reference, respectively — not
something this folder imports from or is imported by.

## The `output/` folder

Every file `index.js` generates — `dataset.json`, `output.json`/`.html` —
is written under `output/` instead of the exercise root, so a glance at
the folder separates "code you read and edit" from "artifacts a run
produced." The whole `output/` directory is gitignored;
`PromptEvaluator.generateDataset`/`runEvaluation`
(`partials/promptEvaluator.js`) create it with `mkdir(..., { recursive:
true })` before writing, so a fresh clone doesn't need the folder
pre-created or committed as a placeholder. 09b-process and 09c-solution
each get their own `output/` for the same reason.
