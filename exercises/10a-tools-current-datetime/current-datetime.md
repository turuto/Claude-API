# Why Claude needs a clock

Claude gets today's date from its system prompt, but has no live clock and
is unreliable at date/time arithmetic on its own. `getCurrentDatetime` is
the first building block for fixing that — a plain function returning
"right now", formatted with a strftime-style format string (see
[[tool-schemas]] in `10z-tools-add-duration` for where those `%`-codes come
from).

This exercise is deliberately just the function, tested directly with
`console.log` — no tool schema, no Claude involvement yet. Turning it into
something Claude can actually call is the next lesson.
