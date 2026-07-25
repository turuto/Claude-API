# Code grading

Builds on [08's model grader](../08-prompt-eval-modelGrader/model-grading.md)
by adding the other two criteria the course identified: format and syntax
validity, both handled by plain code rather than a Claude call.

## Why format/syntax don't need a model

"Does this parse as valid Python/JSON/regex" has one correct answer,
checkable with a parser — asking a model to judge it would be slower,
costlier, and no more reliable than just trying to parse it. Code graders
are the right tool whenever the check is expressible as a deterministic
rule.

## The dataset needs a `format` field now

The syntax validator has to know _which_ parser to run per test case, so
[06's dataset prompt](../06-prompt-eval-dataset/generating-test-datasets.md)
gets one addition — a `"format": "python" | "json" | "regex"` field per
task:

```js
const DATASET_PROMPT = `...
Example output:
\`\`\`json
[
  {
    "task": "Description of task",
    "format": "python"
  },
  ...
]
\`\`\`
...`;
```

This exercise regenerates its own dataset (`generateDataset()`, copied and
extended from 06) rather than reading a static `dataset.json` the way
07/08 do — the whole point is that older datasets don't have the `format`
field this exercise depends on.

## Tightening the prompt, then trapping raw code

08's `runPrompt` sent a bare task description and got back verbose,
explanation-heavy output. This exercise adds explicit format instructions
and prefills a generic fence:

````js
async function runPrompt(testCase) {
    const prompt = `Please solve the following task:

${testCase.task}

* Respond only with Python, JSON, or a plain Regex
* Do not add any comments or commentary or explanation`;

    const messages = [];
    addUserMessage(messages, prompt);
    addAssistantMessage(messages, '```code');

    return chat(messages, { stopSequences: ['```'] });
}
````

` ```code ` isn't a real markdown language tag — it's a generic fence
that commits Claude to "I'm writing a code block" without pre-committing
to _which_ language, the same prefill-and-stop-sequence combo from
[05](../05-structured-data/prefill-and-stop-sequences.md), just with a
placeholder tag instead of a real one. The output that comes back is raw
code with no fence and no prose, ready to feed straight into a parser.

## Three validators, one dispatch table

```js
function validateJson(text) {
    try {
        JSON.parse(text.trim());
        return 10;
    } catch {
        return 0;
    }
}

function validatePython(text) {
    const result = spawnSync('python3', ['-c', 'import ast, sys; ast.parse(sys.stdin.read())'], {
        input: text.trim(),
    });
    return result.status === 0 ? 10 : 0;
}

function validateRegex(text) {
    try {
        new RegExp(text.trim());
        return 10;
    } catch {
        return 0;
    }
}
```

`validateJson` and `validateRegex` translate directly — `JSON.parse` and
`RegExp`'s constructor both throw on invalid input, mirroring
`json.loads`/`re.compile`. `validatePython` can't translate directly: there
is no JS library that understands Python grammar the way Python's own
`ast.parse` does, so this shells out to the system's `python3` via
`node:child_process`'s `spawnSync` and checks its exit status. This is the
one place in the project where a Python runtime is a real (optional in
practice, since only this exercise needs it) dependency of a JS exercise.

Each result maps into a lookup table keyed by the dataset's `format` field:

```js
const SYNTAX_VALIDATORS = { python: validatePython, json: validateJson, regex: validateRegex };

function gradeSyntax(output, testCase) {
    return SYNTAX_VALIDATORS[testCase.format](output);
}
```

## Combining model and code scores

```js
async function runTestCase(testCase) {
    const output = await runPrompt(testCase);
    const modelGrade = await gradeByModel(testCase, output);
    const syntaxScore = gradeSyntax(output, testCase);
    const score = (modelGrade.score + syntaxScore) / 2;

    return { output, testCase, score, reasoning: modelGrade.reasoning };
}
```

A simple average gives task-following and syntax validity equal weight.
Real evals often weight these differently — e.g. weighting syntax higher
when broken output is a hard failure regardless of how well-intentioned the
content is — but an unweighted average is the right starting point before
tuning based on what the eval reveals.

## What this number means

The blended score isn't meaningful in isolation — a 7 or an 8 tells you
nothing about whether the prompt is "good enough." What it's for is
comparison: run this same dataset through a revised prompt, get a new
average, and see whether it moved up. That comparison — not the absolute
number — is the actual output of a prompt eval.
