# Prompt engineering & evaluation demo

A small, self-contained tool for iterating on a prompt and automatically
scoring it against a generated test dataset — the same loop you'd use to
tighten up any prompt in production.

## Setup

```bash
npm install
cp .env.example .env
```

Then get your API key and add it to `.env`:

1. Go to [console.anthropic.com](https://console.anthropic.com), sign in
   (or create an account).
2. Open **API Keys** in the left sidebar and click **Create Key**.
3. Copy the key (you won't be able to view it again after this).
4. Open `.env` in an editor and replace `your-api-key-here` with the copied
   key, so the line reads:
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   ```
5. Save the file. `.env` is gitignored and read automatically — no other
   setup needed.

## Run

```bash
npm start
```

The first run generates a small dataset of test cases for the task (see
`output/dataset.json`), runs the prompt in `index.js` against each case,
grades every output with the model, and writes a report to
`output/output.html` — open that file in a browser to see scores, reasoning,
and each generated output side by side.

## Iterate

1. Open `index.js` and edit the `buildPrompt` function.
2. Re-run `npm start`.
3. Open `output/output.html` again (previous reports are archived
   automatically as `output001.html`, `output002.html`, ...) to compare the
   new score against the last run.

Stuck, or want to see one way to improve the starting prompt step by step? See
[SOLUTION.md](./SOLUTION.md).

## How it's built

- `index.js` — the task description, the prompt you're iterating on, and the
  wiring that runs the evaluation.
- `partials/` — the reusable evaluator: generates diverse test cases,
  concurrently runs your prompt against each one, grades the output with the
  model, and renders the HTML report.
