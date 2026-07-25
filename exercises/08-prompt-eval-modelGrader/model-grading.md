# Model grading

## Three kinds of grader

- **Code graders** — programmatic checks (length, banned words, syntax
  validity). Cheap, deterministic, but limited to what you can express as a
  rule.
- **Model graders** — a second Claude call judges the first call's output.
  Flexible enough for fuzzy criteria (quality, completeness, tone) a rule
  can't capture.
- **Human graders** — most flexible, most expensive, reserved for judgment
  calls no automated check can approximate.

This exercise replaces 07's hardcoded `score = 10` with a real model
grader. [08b](../08b-prompt-eval-codeGrader/code-grading.md) adds a code
grader alongside it.

## Picking criteria per grader type

For the AWS code-generation prompt, the course settles on three criteria:

- **Format** — output should be only code, no explanation. → code grader.
- **Valid syntax** — the code should actually parse. → code grader.
- **Task following** — does the code do what was asked? → model grader,
  since "does this solve the task" isn't expressible as a fixed rule the
  way "does this parse" is.

This exercise only implements task-following (via the model grader); the
format/syntax checks arrive in 08b.

## `gradeByModel`: a second, independent Claude call

````js
async function gradeByModel(testCase, output) {
    const evalPrompt = `You are an expert code reviewer. Evaluate this AI-generated solution.

Task: ${testCase.task}
Solution: ${output}

Provide your evaluation as a structured JSON object with:
- "strengths": An array of 1-3 key strengths
- "weaknesses": An array of 1-3 key areas for improvement
- "reasoning": A concise explanation of your assessment
- "score": A number between 1-10`;

    const messages = [];
    addUserMessage(messages, evalPrompt);
    addAssistantMessage(messages, '```json');

    const evalText = await chat(messages, { stopSequences: ['```'] });
    return JSON.parse(evalText);
}
````

This is a completely separate conversation from `runPrompt`'s — a fresh
`messages` array, not the one the original task ran through. It's the same
prefill (` ```json `) + stop-sequence (` ``` `) technique used since
[06's dataset generation](../06-prompt-eval-dataset/generating-test-datasets.md),
trapping the reply to a clean JSON object.

## Why ask for strengths/weaknesses/reasoning, not just a score

Asking the model for a bare number tends to produce a narrow, unhelpful
band of scores — models default toward a noncommittal ~6 when given no
structure to justify a lower or higher number. Requiring reasoning
alongside the score forces the model to actually commit to a judgment
first, and the score follows from it, rather than being guessed in
isolation. `reasoning` also gets carried through to the final result —
useful for a human skimming _why_ a case scored low, not just that it did.

## Wiring the grader into the pipeline

```js
async function runTestCase(testCase) {
    const output = await runPrompt(testCase);
    const modelGrade = await gradeByModel(testCase, output);

    return { output, testCase, score: modelGrade.score, reasoning: modelGrade.reasoning };
}
```

Only `runTestCase` changed from 07 — `runPrompt` and `runEval`'s loop
structure are untouched, which is the payoff of keeping those three
functions separate from the start.

## The average score

```js
function average(numbers) {
    return numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
}
```

JS has no `statistics.mean` built in, so this is the one-line
`reduce`-based equivalent. `runEval` prints this average across all test
cases — the single number that makes two prompt versions comparable, per
[06's overview notes](../06-prompt-eval-dataset/prompt-evaluation-overview.md).

## Model graders are noisy, not oracles

Re-running this exact script produces a different average score each time
— the same nondeterminism that affects any Claude call at `temperature:
1.0`. Treat the model grader's score as a useful, consistent-_enough_
signal for comparing prompt versions, not as ground truth for any single
run.
