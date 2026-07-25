# Prompt engineering vs. prompt evaluation

## Two different problems

**Prompt engineering** is technique for writing a better prompt: multishot
examples, XML-tag structuring, and similar best practices that help Claude
understand what you're asking for.

**Prompt evaluation** doesn't touch how the prompt is written — it measures
whether a prompt (however written) actually works, via automated testing:
running it against expected answers, comparing versions against each other,
reviewing outputs for errors. This exercise arc (06/07, and whatever follows
for grading) is entirely about the second problem.

## Three paths after drafting a prompt

1. **Test once, ship it.** Fast, but breaks the moment a real user sends an
   input you didn't try.
2. **Test a few times, patch the corner cases you noticed.** Better, but
   real-world input variety reliably exceeds whatever you thought to try —
   this is the trap most engineers fall into by default, not through
   carelessness.
3. **Run it through an eval pipeline, score it objectively, iterate on the
   score.** More upfront work and cost, but the only path that gives
   confidence the prompt holds up outside your own manual testing.

This project's exercises are building path 3.

## The five-step eval workflow

1. **Draft a prompt** — a normal prompt template with a slot for the
   variable input (`{question}`, `{test_case.task}`, etc).
2. **Create an eval dataset** — sample inputs representative of what
   production will actually send through the prompt. This is
   [06's `generateDataset()`](generating-test-datasets.md): a handful of
   cases for a first pass, scaling to hundreds or thousands for a mature eval.
3. **Feed each case through Claude** — merge every dataset entry into the
   prompt template and call the model. This is
   [07's `runPrompt`](../07-prompt-eval-run-eval/eval-pipeline.md).
4. **Feed each response through a grader** — score each output, typically
   1–10, then average across the dataset for one comparable number per
   prompt version. 07's `runTestCase` has the _shape_ of this step
   (`score` in the result object) with the grading logic itself still a
   `TODO` — that's the next exercise.
5. **Change the prompt, repeat** — rerun the same dataset through the
   revised prompt and compare the new average score against the old one.
   An improvement here is evidence, not a guess.

## Why the average score matters

A single number per prompt version — e.g. `(10 + 4 + 9) / 3 = 7.66` — is
what makes step 5 meaningful. Without it, "I tweaked the prompt" is just a
different prompt, with no way to tell if it's actually better. With it,
two prompt versions can be compared numerically, and iteration stops being
guesswork.
