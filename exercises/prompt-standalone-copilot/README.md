# Prompt engineering & evaluation demo (Copilot CLI edition)

A copy of [`../prompt-standalone`](../prompt-standalone) that runs the exact same
prompt-iteration loop — generate a test dataset, run a prompt against it, grade every
output, write an HTML report — through the local **GitHub Copilot CLI** instead of the
Claude API.

## Setup

```bash
npm install
```

This needs the `copilot` CLI installed and already logged into a GitHub Copilot
subscription — there's no API key to put in a `.env` file, since the SDK authenticates
through that existing login instead:

1. Install the CLI if you don't have it: see
   [the GitHub Copilot CLI docs](https://docs.github.com/copilot/how-tos/copilot-cli).
2. Confirm it's installed and logged in:
   ```bash
   copilot --version
   ```
   If you haven't logged in yet, run `copilot` once interactively and follow its
   sign-in prompt.

## Run

```bash
npm start
```

Same behavior as `prompt-standalone`: the first run generates `output/dataset.json`, runs
the prompt in `index.js` against each case, grades every output, and writes
`output/output.html` — open that file in a browser to see scores, reasoning, and each
generated output side by side.

## Iterate

1. Open `index.js` and edit the `buildPrompt` function.
2. Re-run `npm start`.
3. Open `output/output.html` again (previous reports are archived automatically as
   `output001.html`, `output002.html`, ...) to compare the new score against the last run.

New to prompt engineering, or want a refresher on what to actually try? See
[THEORY.md](./THEORY.md) for a short summary of the technique with tips for good prompting.

Stuck, or want to see those tips applied to this project's own starting prompt step by
step? See [SOLUTION.md](./SOLUTION.md). Both are identical to `prompt-standalone`'s, since
the prompt engineering techniques they walk through don't depend on which model is
answering.

## How it's different from `prompt-standalone`

Only `partials/basicChat.js` changed — every other file (`index.js`'s task/prompt, and all
of `partials/` besides `basicChat.js`) is copied over unmodified, since nothing else in
this codebase talks to the model provider directly.

`basicChat.js`'s `chat()` function is rebuilt on `@github/copilot-sdk`'s session API
(`client.createSession()` + `session.sendAndWait()`) instead of
`client.messages.create()`. A few things the Claude version relied on don't have a direct
equivalent in a Copilot session, so this version adapts around them — see the comment
above `chat()` for details:

- No `temperature` control at the session level — every call runs at whatever sampling
  Copilot uses internally.
- No `stop_sequences`, and no way to prefill/continue an assistant turn — the
  `` addAssistantMessage(messages, '```json') `` trick the rest of this codebase uses to
  get clean JSON back is instead turned into an explicit "respond with only JSON" line
  folded into the prompt.
- Each `chat()` call opens a fresh Copilot session (mirroring the Claude version passing a
  full, independent `messages` array on every call) rather than reusing one long-running
  conversation.
