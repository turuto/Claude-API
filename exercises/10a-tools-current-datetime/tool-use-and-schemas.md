# Tool use

By default Claude only knows what was in its training data — no live clock,
no current events, no access to external systems. Tool use bridges that gap:
you describe a function to Claude, Claude decides when it needs to call it
and with what arguments, your code actually runs it, and the result gets fed
back so Claude can finish answering with fresh information instead of "I
don't have access to that."

The round trip looks like:

1. **Initial request** — you send Claude a question plus tool definitions.
2. **Tool request** — Claude decides it needs the tool and replies with a
   `tool_use` block naming it and the arguments to call it with.
3. **Data retrieval** — your code runs the matching function.
4. **Final response** — you send the result back as a `tool_result` block,
   and Claude answers using it.

## The 5 implementation steps

Concretely, building and using a tool breaks down into 5 steps:

1. Write a tool function
2. Write a JSON schema
3. Call Claude with the JSON schema
4. Run the tool
5. Add the tool result and call Claude again

This exercise (and `10z-tools-add-duration`) only covers **steps 1 and 2** —
the plain function plus its schema, tested directly with `console.log`.
Steps 3-5 (actually passing the schema to `messages.create` via `tools:
[...]`, running the tool Claude asks for, and sending the result back) are
still to come.

## The reminders project

The concrete goal across this set of exercises: let a user say "remind me
about my doctor's appointment a week from Thursday" and have Claude actually
set it. Three gaps stand between Claude and that:

- **No time awareness** — Claude knows today's date (from the system
  prompt) but not the current time. → `getCurrentDatetime`, this exercise.
- **Unreliable date math** — Claude isn't great at adding durations to
  dates by itself, especially far into the future. → `addDurationToDatetime`,
  in `10z-tools-add-duration`.
- **No reminder mechanism** — Claude has no built-in way to actually set
  one. → a `setReminder` tool, not built yet.

Each gap gets its own tool, built one at a time, before wiring them together.

## Writing the tool function

A tool function is just a plain function — nothing Claude-specific about the
function body itself. The lesson's best practices:

- **Descriptive names** for both the function and its parameters — the name
  is part of what tells Claude when to reach for it.
- **Validate inputs** and raise/throw on invalid ones rather than silently
  guessing.
- **Give meaningful error messages** — Claude sees them and can retry the
  call with corrected arguments, so a clear message (e.g. "dateFormat cannot
  be empty") is more useful to Claude than a generic one.

(Note: `getCurrentDatetime` in `index.js` currently falls back to the
default format on an empty string instead of throwing — a deliberate
deviation from the lesson's `raise ValueError`, kept as-is.)

## Tool schemas

JSON Schema itself isn't an AI-specific format — it's a general data
validation spec that predates LLMs by years. The Anthropic API just uses it
to describe a tool's shape. A tool definition has three parts:

- `name` — short, descriptive (e.g. `get_current_datetime`).
- `description` — what it does, when Claude should reach for it, and what
  it returns. The lesson's rule of thumb: 3-4 sentences, not one.
- `input_schema` — the actual JSON Schema for the function's arguments,
  with a `description` on each property too.

The description is the only documentation Claude gets — there's no separate
docstring or comment it can see — so being explicit here (units, defaults,
output format, when to use it) directly affects whether Claude calls the
tool correctly, or at all.

A handy trick from the lesson for writing one from scratch: paste the
function into a chat with Claude, alongside Anthropic's tool-use docs, and
ask it to write the schema for you following those best practices, rather
than hand-writing the JSON Schema every time.

**Naming convention**: pair each function with a schema named
`<functionName>Schema` — `getCurrentDatetime` / `getCurrentDatetimeSchema`
here — so the two are easy to spot as a pair when a file has several tools.

## `ToolParam` — Python-only, no JS equivalent

The lesson suggests wrapping the schema dict with `anthropic.types.ToolParam`
for "type safety." In the Python SDK, `ToolParam` is a `TypedDict` — a
static-typing construct with **zero runtime effect**; it only helps an
editor/type-checker flag a malformed schema before you run the code. It's
never actually instantiated as an object.

This project's hard rule against TypeScript/type annotations (see
`CLAUDE.md`) means there's nothing to add here in JS — the plain
`getCurrentDatetimeSchema` object literal in `index.js` already *is* the
full runtime equivalent of what `ToolParam` type-checks in Python.
