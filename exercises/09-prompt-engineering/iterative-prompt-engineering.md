# Iterative prompt engineering

## Prompt engineering vs. prompt evaluation

Prompt evaluation (06-08) built the _measurement_ tools — a dataset, a
grader, an average score. Prompt engineering is what you do _with_ that
measurement: take a prompt, get a score, change the prompt, get a new
score, and keep the change only if the score actually moved.

## The five-step cycle

1. **Set a goal** — what should the prompt accomplish?
2. **Write an initial prompt** — a basic, even deliberately naive, first
   attempt.
3. **Evaluate the prompt** — run it through the eval pipeline from 06-08.
4. **Apply a prompt engineering technique** — one concrete, specific change.
5. **Re-evaluate** — confirm the change actually improved the score before
   keeping it.

Steps 4 and 5 repeat until the score is good enough. The important
discipline is changing _one thing at a time_ — if you change three things
between evaluation runs and the score improves, you don't know which
change did the work (or whether one change helped while another hurt).

## Don't be discouraged by a low baseline

A naive first prompt — literally "What should this person eat?" plus the
raw inputs, no structure, no guidance, no examples — routinely scores
around 2/10 against a rigorous grader. That's expected, not a sign
something is broken. The number only becomes useful once you have a second
number, from a revised prompt, to compare it against.

## What this exercise's prompt already applies

`index.js`'s `runPrompt` isn't the naive baseline described above — it's
already a few engineering techniques ahead of it:

- **Explicit, numbered guidelines** (calorie total, macros, timing, portion
  sizes) instead of a vague "what should this person eat?"
- **XML-tagged input** (`<athlete_information>`) — the same structural
  delimiting technique from
  [08's model-grading notes](../08-prompt-eval-modelGrader/model-grading.md#why-task-solution-and-criteria-all-get-their-own-tags),
  applied here to the task prompt rather than the grading prompt.
- **A fully worked example** (`<sample_input>` / `<ideal_output>`) —
  few-shot prompting: showing the model one complete, high-quality answer
  is often more effective than describing requirements in the abstract.

`compare-baseline.js` runs both prompts — the naive one above and the
engineered one — through the exact same dataset and grader, so the
step 3→4→5 score jump isn't hypothetical:

```
npm run 09          # generates output/dataset.json if you don't have one yet
npm run 09-compare
```

One real run scored the naive prompt 2/10 and the engineered prompt 7/10
on the same test case. The grader's own reasoning for the naive prompt's
score is worth reading (`output/baseline-naive.json`) — it didn't fail on
nutrition knowledge, it failed by never actually producing a meal plan,
ending with "Would you like specific meal ideas?" instead of the
foods/portions/timing the task asked for. That's the kind of concrete,
fixable failure a rigorous grader with `extraCriteria` is meant to surface
— see [grading-and-reports.md](grading-and-reports.md).
