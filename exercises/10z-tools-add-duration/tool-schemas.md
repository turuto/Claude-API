# Tool schemas

A tool given to Claude is two things: a plain function that does the work,
and a JSON schema describing it (name, description, `input_schema`) that gets
passed in the `tools` array on `messages.create`. Claude never runs the
function itself — it replies with a `tool_use` block naming the tool and the
arguments it wants to call it with, and the caller is responsible for running
the matching function and sending the result back as a `tool_result` block.
That loop isn't wired up yet in this exercise — just the function + schema.

The description in the schema is the only documentation Claude gets for the
tool. It's worth being as explicit as the lesson's Python version is (unit
options, default values, output format) rather than a one-line summary,
since a vague description is what leads to Claude calling a tool with the
wrong arguments or not calling it when it should.

## Why JS needed more code than the Python original

Python's `datetime.strptime`/`strftime` parse and format dates from format
strings like `%Y-%m-%d` directly. JS has no built-in equivalent, so
`parseWithFormat` in `utils.js` translates a handful of those format codes
into a regex to fill in manually. It only supports the directives this
lesson's tool schema advertises (`%Y %m %d %H %I %M %S %p`) — not the full
strptime set. That plumbing is split out of `index.js` so the tool file
itself stays about the tool + schema, not the date-format mechanics.

The month/year math also needed manual clamping: `date.setMonth()` rolls
overflow days into the next month (Jan 31 + 1 month → Mar 3) instead of
clamping like Python's lesson code does for months. `addCalendarUnit` reuses
the same clamping for years too, which is a deliberate improvement over the
Python original — its `years` branch calls `date.replace(year=...)` directly,
which raises on Feb 29 landing in a non-leap year.
