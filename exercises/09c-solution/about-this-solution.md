# What this folder is

A completed reference copy of [09a-prompt-engineering](../09a-prompt-engineering),
built by applying the theory in that exercise's notes to its naive
starting prompt. 09a stays pristine and [09b-process](../09b-process) is
the working copy meant for your own edits; this folder keeps an
already-engineered version alongside both so you have something concrete
to compare your own iterations against, without spoiling the exercise
itself.

For the actual theory (the five-step iterative cycle, why a low baseline
score is normal, what `extraCriteria` and the HTML report do), see
09a-prompt-engineering's notes — this folder doesn't duplicate them.

## Files

- `index.js` — same pipeline as 09a/09b, `runPrompt` wired to the
  engineered prompt.
- `partials/mealPlanPrompts.js` — keeps _both_ `buildNaiveMealPlanPrompt`
  and `buildEngineeredMealPlanPrompt` (09a/09b's own copies only have the
  naive one), so `compare-baseline.js` below can grade both without
  needing to reach into another exercise folder.
- `compare-baseline.js` (`npm run 09c-compare`) — runs both prompts
  through this folder's own generated dataset and grader, printing both
  averages. One real run: naive 2/10, engineered 7/10.

This is a copy, not a shared module — nothing outside `09c-solution/`
imports from it, and it doesn't import from `09a-prompt-engineering/` or
`09b-process/` either, matching every other exercise's independence.
