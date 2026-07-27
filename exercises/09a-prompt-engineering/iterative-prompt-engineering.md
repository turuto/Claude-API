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

Steps 1-3 map directly onto this exercise's own code: "set a goal" is
`taskDescription`, "write an initial prompt" is `buildPrompt`/`runPrompt`,
and "evaluate" is `evaluator.runEvaluation(...)` — see
[prompt-evaluator-class.md](prompt-evaluator-class.md) for how
`generateDataset`/`runEvaluation` actually work and
[grading-and-reports.md](grading-and-reports.md) for how `extraCriteria`
turns specific requirements (calorie total, macros, meal timing) into hard
grading gates. Two knobs worth keeping low while you're mid-cycle, both
already dialed down in this exercise's `index.js`/`09b-process/index.js`:
`maxConcurrentTasks` (avoid rate-limit errors) and `numCases` (fewer test
cases means a faster loop) — turn both up only for a final, more confident
validation pass once you're happy with a prompt.

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

## Techniques, in order to try them

Each of these is a separate five-step-cycle iteration — apply one, re-run
`npm run 09b`, confirm the score moved, then move to the next. Course
scores for this exact meal-plan prompt, applied in this order: naive 2.32
→ clear-and-direct 3.92 → +guidelines 7.86 → +structure/examples further
still. Treat those as a rough prior for where the biggest jumps are, not a
target to match exactly — the point is _your_ score going up in
09b-process as you apply these one at a time.

### 1. Be clear and direct

The first line of a prompt does the most work — it's where Claude decides
what task it's even doing before it reads anything else. Two things to
fix there:

- **Clear** — plain language, name the thing you want directly instead of
  describing around it.
- **Direct** — an instruction, not a question, opening with an action
  verb (_Write_, _Generate_, _Identify_), not a lead-in like "I was
  wondering..." or "What should...".

This exercise's naive `What should this person eat?` becomes
`09c-solution`'s `Generate a one-day meal plan for an athlete that meets
their dietary restrictions.` — one line that now states the action
(generate), the artifact (a meal plan), and the key constraints (one day,
athlete, dietary restrictions), where the question form left all three
for Claude to infer. This is worth trying _before_ the other techniques
below — guidelines, structure, and examples all assume Claude already
understood the task; fixing the opening line is what gets it there.

### 2. Be specific

Left unconstrained, Claude has to guess at things you actually care about
— how long the response should be, what it must include, how it's
structured. Being specific means closing that gap by giving Claude a
clearer target to aim for. There are two kinds:

- **Output quality guidelines** — properties the final answer must have:
  length, structure, required elements, tone. Checked _after the fact_,
  against the finished response. Use these in almost every prompt — cheap
  insurance against inconsistent results.
- **Process steps** — a sequence you want Claude to work through _before_
  answering, e.g. brainstorm several options, pick the best one, then
  write it up. Reach for these on top of guidelines specifically when the
  task benefits from considering multiple angles first — troubleshooting,
  decision-making, anything where jumping straight to an answer risks
  tunnel vision on the first idea.

`09c-solution`'s engineered prompt only uses the first kind: six numbered
output guidelines (daily calorie amount, protein/fat/carb amounts, meal
timing, restriction compliance, portion sizes in grams,
budget-friendliness), no process steps, since generating a meal plan
doesn't need Claude to reason through competing hypotheses the way
diagnosing a performance problem would. Process steps are worth trying in
`09b-process` if a guidelines-only prompt plateaus — e.g. asking Claude to
first list the athlete's key constraints, then draft the plan against
them.

This is the technique worth reaching for right after clear-and-direct
phrasing, before structure or examples: the course reports guidelines
alone raising this meal-plan prompt's score from 3.92 to 7.86 — more than
double, from one change.

### 3. Structure input with XML tags

When a prompt mixes instructions with real data — especially several
distinct pieces of it — wrap each piece in a descriptive tag so Claude
doesn't have to guess where one section ends and another begins. The tags
don't need to be "real" XML; invented names are fine and should be as
specific as the content they wrap (`<athlete_information>`, not
`<data>`). This is the same delimiting idea as
[08's model-grading prompt](../08-prompt-eval-modelGrader/model-grading.md#why-task-solution-and-criteria-all-get-their-own-tags)
giving `<task>`/`<solution>`/`<criteria>` their own tags — applied here to
the task prompt itself rather than the grading prompt.

`09c-solution`'s engineered prompt wraps the four athlete inputs in
`<athlete_information>...</athlete_information>` ahead of the
instructions. For a short, four-line block like this one the gain is
modest — tagging matters more the larger and more mixed a prompt's
interpolated content gets (pages of records, code alongside docs, several
unrelated inputs at once).

### 4. Provide examples (one-shot / multi-shot)

Showing Claude a sample input paired with an ideal output — one example
is "one-shot," several covering different cases is "multi-shot" — often
teaches format, tone, or edge-case handling more reliably than describing
it in prose. The canonical case is sarcasm in sentiment classification:
"Oh yeah, I really needed a flight delay tonight! Excellent!" reads as
positive taken literally, and only an example demonstrating
sarcasm-as-negative closes that gap.

Practices worth following when adding examples:

- Wrap each pair in tags (`<sample_input>` / `<ideal_output>`), the same
  structuring idea as technique 3, applied to the example itself.
- State plainly what you're showing ("Here is an example input with an
  ideal response") rather than leaving Claude to infer it.
- Add a sentence on _why_ the example output is good, not just the output
  itself — the reasoning transfers better than the raw example alone.
- Mine your own eval's highest-scoring outputs for these — a real
  input/output pair that already scored well against your grader is a
  better example than one written from scratch.

`09c-solution`'s engineered prompt follows the first three of those: it
states plainly that an example follows, wraps the pair in
`<sample_input>`/`<ideal_output>` tags (a 170cm/70kg athlete managing
cholesterol), and closes with a sentence on why that output is
well-structured. Examples are the most expensive technique to write and
maintain, so it's usually the last one reached for — after the opening
line, the guidelines, and the input structure are already in place.
