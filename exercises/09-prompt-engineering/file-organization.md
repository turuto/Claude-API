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
- `mealPlanPrompts.js` — the two meal-plan prompt variants
  (`buildNaiveMealPlanPrompt`/`buildEngineeredMealPlanPrompt`), pulled out
  of `index.js` so `compare-baseline.js` (see below) can use both without
  duplicating either.

`index.js` is left as just the part of the original notebook you're
actually meant to edit while doing prompt engineering: instantiate the
evaluator, generate a dataset, define `runPrompt`, run the evaluation. This
mirrors 002_prompting_completed.ipynb's own last few cells — the class and
its helpers are lesson infrastructure, `index.js` is the exercise.

## `compare-baseline.js`

A second, non-`index.js` entry point (`npm run 09-compare`) that runs the
naive and engineered prompts through the _same_ dataset and grader and
prints both averages — see
[iterative-prompt-engineering.md](iterative-prompt-engineering.md#dont-be-discouraged-by-a-low-baseline)
for what it's demonstrating and a real result. It depends on
`output/dataset.json` already existing (run `npm run 09` first) rather
than generating its own, specifically so both prompts are graded against
identical test cases.

This is still a self-contained exercise folder, not a shared module across
exercises — `partials/` only exists inside `09-prompt-engineering/` and
nothing outside this folder imports from it, matching every other
exercise's independence.

## The `output/` folder

Every file either script generates — `dataset.json`, `output.json`/
`.html` from `index.js`, `baseline-naive.*`/`baseline-engineered.*` from
`compare-baseline.js` — is written under `output/` instead of the exercise
root, so a glance at the folder separates "code you read and edit" from
"artifacts a run produced." The whole `output/` directory is gitignored;
`PromptEvaluator.generateDataset`/`runEvaluation`
(`partials/promptEvaluator.js`) create it with `mkdir(..., { recursive:
true })` before writing, so a fresh clone doesn't need the folder
pre-created or committed as a placeholder.
