# Mandatory criteria and the HTML report

`gradeOutput` and `generatePromptEvaluationReport` (discussed below) live
in `partials/promptEvaluator.js` and `partials/report.js` respectively —
see [file-organization.md](file-organization.md) for the full layout.

## `extraCriteria`: requirements that override the normal scoring band

08's grader treated every criterion the same — meet more of them, score
higher. This exercise's `gradeOutput` adds a second, stricter category via
`extraCriteria`, rendered into the grading prompt only when supplied:

```js
const extraCriteriaSection = extraCriteria
    ? `
Mandatory Requirements - ANY VIOLATION MEANS AUTOMATIC FAILURE (score of 3 or lower):
<extra_important_criteria>
${extraCriteria}
</extra_important_criteria>
`
    : '';
```

The grading prompt's scoring guidelines make this a hard gate, not a
suggestion: violating anything in `extraCriteria` caps the score at 3
_regardless_ of how well the output satisfies `solution_criteria`. This
matters for requirements that are genuinely non-negotiable (the meal
plan's caloric total, macronutrient breakdown, and per-meal timing/portion
detail) as opposed to per-test-case criteria that are more about overall
quality. Splitting "must-have, checked every run" from "specific to this
scenario" keeps `solution_criteria` from having to repeat the same
boilerplate requirement in every generated test case.

## `runTestCase`'s output object doesn't carry `extraCriteria` forward

`extraCriteria` flows into the grading prompt but isn't stored on the
result the way `testCase`/`output`/`score`/`reasoning` are — it's a
property of the _evaluation run_, not of any individual test case, so it
only needs to exist for the duration of grading.

## The HTML report

`generatePromptEvaluationReport(results)` builds a static HTML document —
summary stats (total cases, average score, pass rate at ≥7) plus one table
row per test case, colour-coded by score band (green ≥8, yellow 6-7, red
≤5). This is a direct translation of the Python `f"""..."""` template into
a JS template literal; the CSS is unchanged.

One simplification: Python's HTML template originally used `{{` / `}}` to
escape literal curly braces inside an f-string (since `{` in an f-string
normally means "interpolate here"). JS template literals only treat `${`
specially, so plain `{` and `}` in the CSS needed no escaping at all —
translating the CSS block was a straight copy, not a search-and-replace.

Like the Python original, table cells (`output`, `reasoning`, etc.) are
inserted into the HTML without escaping. That's fine for a report you
generate and open locally yourself, but worth knowing if this were ever
adapted to render untrusted content.

`runEvaluation` writes this alongside a plain `output.json` (the same
`results` array 07/08 already returned) — the JSON is for feeding back
into more tooling, the HTML is for a human to skim.
