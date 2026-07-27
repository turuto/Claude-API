# Why Claude needs a clock

Claude gets today's date from its system prompt, but has no live clock and
is unreliable at date/time arithmetic on its own. `getCurrentDatetime` is
the first building block for fixing that — a plain function returning
"right now", formatted with a strftime-style format string (see
[[tool-use-and-schemas]] for where those `%`-codes come from and how the
schema alongside it works).

This function is still tested directly with `console.log` — no `messages.create`
call yet. The schema in this same file describes the function to Claude, but
actually wiring it into a `tools: [...]` call and handling the
`tool_use`/`tool_result` round trip is the next exercise.
