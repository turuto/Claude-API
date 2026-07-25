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

Task:
<task>
${testCase.task}
</task>

Solution to Evaluate:
<solution>
${output}
</solution>

Criteria you should use to evaluate the solution:
<criteria>
${testCase.solution_criteria}
</criteria>

Provide your evaluation as a structured JSON object with:
- "strengths": An array of 1-3 key strengths
- "weaknesses": An array of 1-3 key areas for improvement
- "reasoning": A concise explanation of your assessment
- "score": A number between 1-10`;

    const messages = [];
    addUserMessage(messages, evalPrompt);
    addAssistantMessage(messages, '```json');

    return chatJson(messages, { stopSequences: ['```'] });
}
````

This is a completely separate conversation from `runPrompt`'s — a fresh
`messages` array, not the one the original task ran through. It's the same
prefill (` ```json `) + stop-sequence (` ``` `) technique used since
[06's dataset generation](../06-prompt-eval-dataset/generating-test-datasets.md),
trapping the reply to a clean JSON object.

## Why `<task>`, `<solution>`, and `<criteria>` all get their own tags

The prompt hands the grader three different pieces of text back to back —
the original task, the output being judged, and the rubric to judge it
against. Left as plain labeled paragraphs, a long or code-heavy `output`
(which may itself contain the words "task" or "criteria" in a comment or
string) could blur where one section ends and the next begins. Wrapping
each in its own XML tag (`<task>`, `<solution>`, `<criteria>`) removes that
ambiguity — Claude reliably treats XML tags as structural delimiters, not
as content to interpret, so `<criteria>{testCase.solution_criteria}</criteria>`
is unambiguously "the rubric," never mistakable for part of the solution
being graded even if the solution's own text is messy or adversarial. This
is the same "structuring with XML tags" technique named in
[06's overview notes](../06-prompt-eval-dataset/prompt-evaluation-overview.md) —
applied here to the grading prompt rather than the task prompt.

## Giving the grader a reference point: `solution_criteria`

Without anything to check against, "how good is this?" is a vague question
even for a careful grader — it ends up judging general code quality
instead of whether _this task_ was actually solved. `generateDataset()`'s
prompt now asks for a `solution_criteria` field per test case, alongside
`task`:

```js
const DATASET_PROMPT = `...
Example output:
\`\`\`json
[
  {
    "task": "Description of task",
    "solution_criteria": "What a correct solution to this task must include"
  },
  ...
]
\`\`\`
...
* "solution_criteria" should be concrete and checkable, not vague praise like "well-written"
...`;
```

That criteria then flows straight into the grading prompt above. This
exercise generates its own dataset for that reason — 07's static
`dataset.json` (bare `task` only) doesn't carry `solution_criteria`, so
this is the first exercise in the arc since 06 to call `generateDataset()`
itself rather than reading a committed fixture.

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

## `chatJson`: prefilled JSON isn't guaranteed to actually be valid JSON

`generateDataset()` and `gradeByModel` both prefill ` ```json ` and hand
the result straight to `JSON.parse`, but that reply is still model output —
nothing stops Claude from writing a string that JSON.parse rejects. In
practice this happens _often_ when a test case discusses a regex pattern:
grading a case like "write a regex for an IAM role ARN," the grader's own
`weaknesses`/`reasoning` text tends to quote that regex verbatim —
backslashes and all — without doubling them the way a JSON string value
requires. `\d{12}` typed directly into a JSON string is invalid; it needs
to be `\\d{12}`.

Because this is a systematic tendency (the model consistently makes the
same mistake when the content itself invites it), retrying alone doesn't
reliably fix it — a fresh sample can hit the exact same slip. The real fix
is sanitizing the response before parsing:

```js
function escapeStrayBackslashes(text) {
    return text.replace(/\\["\\/bfnrtu]|\\/g, (match) => (match.length === 2 ? match : '\\\\'));
}

async function chatJson(messages, chatOptions, retries = 2) {
    for (let attempt = 1; ; attempt++) {
        const text = await chat(messages, chatOptions);
        try {
            return JSON.parse(escapeStrayBackslashes(text));
        } catch (err) {
            if (attempt > retries) throw err;
        }
    }
}
```

The regex alternation matters: `\\["\\/bfnrtu]` matches a backslash
_together with_ the character right after it whenever that pair is already
a valid JSON escape (`\"`, `\\`, `\/`, `\b`, `\f`, `\n`, `\r`, `\t`, or the
start of `\uXXXX`), consuming both characters as one unit so the scan
doesn't loop back and reinterpret the second character of a valid pair as
a stray backslash of its own. Only a backslash that _doesn't_ pair up this
way falls through to the second alternative and gets escaped. An earlier
version of this used a negative-lookahead (`\\(?!["\\/bfnrtu])`) instead —
it looked simpler, but scans one character at a time and has no memory of
"I already matched this backslash as part of a pair," so it incorrectly
flagged the second backslash of an already-valid `\\` escape as if it were
a fresh one, corrupting perfectly valid JSON. Matching pairs atomically is
what fixes that.

This is still an external-API boundary — the retry loop (resample a fresh
completion) stays as a backstop for whatever _other_ way a model response
could fail to parse, but the sanitization step is what actually resolves
the recurring backslash case. `chatJson` replaces the bare
`chat(...)` + `JSON.parse(...)` pairing everywhere this exercise parses a
model's JSON reply.

## Model graders are noisy, not oracles

Re-running this exact script produces a different average score each time
— the same nondeterminism that affects any Claude call at `temperature:
1.0`. Treat the model grader's score as a useful, consistent-_enough_
signal for comparing prompt versions, not as ground truth for any single
run.
