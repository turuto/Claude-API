# API Course — JavaScript Exercises

A vanilla-JavaScript companion to Anthropic's "Building with the Claude API" course. The
course notebooks are Python; each exercise here is a hand-translated JavaScript
version using the official [`@anthropic-ai/sdk`](https://github.com/anthropics/anthropic-sdk-typescript).

## Setup

1. Install dependencies (already done if you just ran the initial setup):

    ```bash
    npm install
    ```

2. Add your API key:

    ```bash
    cp .env.example .env
    ```

    Then edit `.env` and replace the placeholder with your real key:

    ```
    ANTHROPIC_API_KEY=sk-ant-...
    ```

    `.env` is gitignored — it will never be committed.

## Running an exercise

Each exercise lives in its own numbered folder under `exercises/`, with the
runnable script always named `index.js` — no build step, no TypeScript, no
transpiler:

```bash
node exercises/00-hello-claude/index.js
```

Or use the npm shortcut:

```bash
npm run 00-hello
```

## Adding a new exercise

Follow along with each lesson by adding a numbered folder to `exercises/`, e.g.:

```
exercises/02-chat-loop/index.js
exercises/03-tool-use/index.js
```

Add a matching npm script for it in `package.json`, then run the same way:

```bash
npm run 02-chat-loop
```

## Notes files

Each exercise folder can also hold one or more Markdown notes files,
named after the concept they cover (not a fixed `notes.md`) — e.g. an
exercise might have both `tools.md` and `tools-vs-workflows.md` if it
touches on more than one topic. These capture what was learned for later
study; they're not required reading to run the exercise.

## Project structure

```
.
├── exercises/
│   ├── 00-hello-claude/
│   │   ├── index.js          # verifies the setup end-to-end
│   │   └── messages-api.md   # notes on the Messages API basics
│   └── 01-user-input/
│       ├── index.js
│       └── reading-user-input.md
├── .env                       # your API key (gitignored, not committed)
├── .env.example                # placeholder template
└── package.json
```
