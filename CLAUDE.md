duplicate the 02 exercise into
04-response-streaming.# CLAUDE.md

## What this project is

A vanilla-JavaScript companion to Anthropic's **"Building with the Claude API"** course.
The course itself uses Python + Jupyter notebooks. The user knows JS but not
Python, so instead of following along in Python, they translate each lesson's
Python code into JavaScript themselves, using this project as the place to do it.

**Role going forward:** when the user pastes/describes a Python lesson
snippet, help them translate it into a new numbered folder under `exercises/`
using the patterns below — not by porting Python idioms literally, but by
writing idiomatic JavaScript against the official SDK.

## Hard rule: never use TypeScript

This project is JavaScript-only. Never write `.ts` files, never add
`typescript`/`tsx`/`@types/*`/a `tsconfig.json`, never suggest type
annotations or interfaces. This applies even if it would otherwise be
idiomatic — e.g. don't add JSDoc type annotations as a substitute for TS
either, unless the user asks for that specifically. If a lesson snippet is
easier to reason about with types, translate it to plain JS anyway.

## Code style

- Always use single quotes for strings in JS, never double quotes.
- Always terminate statements with semicolons — don't rely on ASI.
- Formatting (indentation, semicolons, spacing) is enforced by Prettier
  (`.prettierrc` — `singleQuote: true`, `semi: true`, `printWidth: 120`),
  wired to run on save in VS Code (`.vscode/settings.json`). Run
  `npm run format` to format the whole project manually.

## Current state

- Project was originally scaffolded in TypeScript, then converted to vanilla
  JavaScript at the user's request, then restructured so each exercise lives
  in its own folder (see Project structure below). `00-hello-claude/index.js`
  and `01-user-input/index.js` are both **verified working end-to-end**
  against the real API.
- The user's real `ANTHROPIC_API_KEY` is already in `.env` (gitignored, untracked).
- No git repository has been initialized yet in this directory.

## Stack

- Node (v24, via nvm), plain JavaScript, ESM (`"type": "module"` in package.json)
- `@anthropic-ai/sdk` (official SDK) + `dotenv` — runtime deps; `prettier` is
  the only dev dep, used for formatting only (see Code style)
- Run files directly, no build step, no transpiler: `node exercises/<NN-name>/index.js`
- ESLint `max-len` rule set to 120 chars (`eslintConfig` in package.json) — keep
  lines, including comments, under that.

## Project structure

```
.
├── exercises/
│   ├── 00-hello-claude/
│   │   ├── index.js          # verified working end-to-end example
│   │   └── messages-api.md   # notes on concepts learned
│   └── 01-user-input/
│       ├── index.js
│       └── reading-user-input.md
├── .env                    # real API key, gitignored — DO NOT print/commit its contents
├── .env.example            # placeholder template (safe to show/edit)
├── package.json            # "type": "module"; has an npm run <NN-name> shortcut per exercise
└── README.md                # user-facing setup/run instructions
```

## Conventions for new exercise files

- Each exercise gets its own folder: `exercises/NN-description/` (e.g.
  `02-chat-loop/`, `03-tool-use/`), matching lesson order.
- The runnable script inside is always named `index.js` — never named after
  the exercise itself.
- Add a matching npm script (`"NN-description": "node exercises/NN-description/index.js"`)
  in `package.json` for every new exercise, mirroring the existing ones.
- Each script is standalone: `import "dotenv/config"` at the top, then
  `new Anthropic()` (reads `ANTHROPIC_API_KEY` from env automatically — never
  hardcode the key or read it manually).
- Keep each exercise self-contained and runnable on its own — no shared
  helper modules across exercise folders unless the user asks for one.
- Default model: `claude-opus-4-8`, unless the lesson being translated is
  specifically about a different model, the exercise is trivial enough to
  warrant a cheaper model (e.g. a smoke test), or the user says otherwise.
- Translate the _intent_ of the Python lesson code, not a literal line-by-line
  port — e.g. Python's `for block in response.content: if block.type == "text"`
  becomes the same loop shape in JS, but things like context managers,
  decorators (`@beta_tool`), or Python-only idioms need an idiomatic JS
  equivalent (see the SDK usage notes below).
- Comments go on the main blocks (client setup, the API call, response
  handling), not every line. If a single line would be cramped, split the
  comment across multiple lines rather than compressing it — clarity over
  terseness for comments specifically.

## Notes files (per exercise)

- Alongside `index.js`, an exercise folder can hold one or more Markdown
  notes files capturing the concepts learned, for later study.
- Name notes files after the **topic**, not a fixed `notes.md` — e.g.
  `messages-api.md`, `tools.md`, `tools-vs-workflows.md`. One exercise can
  have several notes files if it touches on more than one distinct concept.
- These are for the user's own study later; don't let them block or gate
  running the exercise.

## SDK usage notes (avoid stale/training-prior mistakes)

This project was set up using Anthropic's own internal `claude-api` skill
reference, which flagged that a lot of API/SDK knowledge from model training
data is stale. Key points to keep applying as new exercises are added:

- **Thinking:** use `thinking: { type: "adaptive" }` for anything nontrivial
  (agentic loops, multi-step reasoning). Do not use the old
  `{ type: "enabled", budget_tokens: N }` form — it's rejected (400) on
  current models like `claude-opus-4-8`.
- **Effort:** `output_config: { effort: "low" | "medium" | "high" | "xhigh" | "max" }`
  controls thinking depth/cost — nested under `output_config`, not top-level.
- **Tool use:** prefer the SDK's Tool Runner
  (`client.beta.messages.toolRunner(...)` with `betaZodTool(...)` from
  `@anthropic-ai/sdk/helpers/beta/zod`) over hand-rolling the tool-call loop,
  unless a lesson is specifically teaching the manual loop. `betaZodTool`
  still works from plain JS — Zod schemas don't require TypeScript.
- **Streaming:** for large `max_tokens`, use `client.messages.stream(...)`
  with `.finalMessage()` rather than a large non-streaming call (avoids HTTP
  timeouts).
- **Errors:** catch the SDK's typed exceptions (`Anthropic.RateLimitError`,
  `Anthropic.APIError`, etc.), most-specific first — don't string-match error
  messages.
- Don't guess SDK method/property names — if unsure, check
  `node_modules/@anthropic-ai/sdk` source/types or ask, rather than researching
  first; run the file and let the actual runtime error point at the mistake.
- Full model list, pricing, and migration notes: the `claude-api` skill
  (available via the Skill tool) has an exhaustive reference (installation,
  thinking, caching, streaming, tool use, structured outputs, batches, files
  API, etc.) — invoke it if a lesson needs a feature not yet used in this repo
  (e.g. prompt caching, structured outputs, batches). Its examples are shown in
  TypeScript; translate them to plain JS the same way as course lessons.

## Running things

```bash
node exercises/00-hello-claude/index.js   # or: npm run 00-hello
node exercises/01-user-input/index.js     # or: npm run 01-user-input
```

## Things NOT to do

- Never write TypeScript — see the hard rule above.
- Don't commit `.env` or print its contents.
- Don't add a build step / bundler / transpiler — the point of this setup is
  running `.js` files directly with Node, no compile step.
- Don't introduce a shared `client.js` / helper module preemptively — each
  exercise file constructs its own client. Only refactor to a shared helper
  if the user explicitly asks, since these are meant to be standalone,
  readable lesson translations.
- Don't name the script inside an exercise folder anything other than
  `index.js`, and don't force notes into a single fixed `notes.md` filename.
