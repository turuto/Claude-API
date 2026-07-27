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

## This exercise is split across three folders

- **09a-prompt-engineering** (here) — the naive starting prompt, kept
  pristine as a reference. `npm run 09a` reproduces the low baseline score
  any time you want to see it again.
- **[09b-process](../09b-process)** — a working copy of this same code.
  Do your actual editing there, not here — that's the point of keeping
  this folder untouched.
- **[09c-solution](../09c-solution)** — one possible engineered prompt,
  plus a `compare-baseline.js` that grades it against this exact naive
  prompt on the same dataset.

`index.js`'s `runPrompt` builds exactly the naive prompt described above —
no structure, no guidelines, no example. It lives directly in `index.js`
rather than a `partials/` file, since it's the one thing in this exercise
you're actually meant to edit — see
[file-organization.md](file-organization.md). The five-step cycle in
practice:

```
npm run 09b     # 1-3: generates a dataset, runs the current prompt, grades it
# edit the prompt in 09b-process/index.js's runPrompt — one change at a time
npm run 09b     # 4-5: re-run and check 09b-process/output/output.json (or output.html)
```

Techniques worth trying, roughly in order of impact for this task:

- **Explicit, numbered guidelines** — spell out what the output must
  contain (daily calorie total, macros, meal timing, portion sizes)
  instead of leaving it implicit in "what should this person eat?"
- **XML-tagged input** (e.g. `<athlete_information>`) — the same
  structural delimiting technique from
  [08's model-grading notes](../08-prompt-eval-modelGrader/model-grading.md#why-task-solution-and-criteria-all-get-their-own-tags),
  applied here to the task prompt rather than the grading prompt.
- **A fully worked example** (`<sample_input>` / `<ideal_output>`) —
  few-shot prompting: showing the model one complete, high-quality answer
  is often more effective than describing requirements in the abstract.

One real run scored the naive prompt 2/10 and 09c-solution's engineered
version 7/10 on the same test case — a target to beat if you want one, or
something to compare notes against once you have your own result. Either
way, the point of this exercise is _your_ score going up in 09b-process as
you apply these one at a time, not matching that number exactly.
