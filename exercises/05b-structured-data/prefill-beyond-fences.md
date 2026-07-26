# Prefilling with a full sentence, not just a fence

Builds on [05 — prefill + stop sequences](../05-structured-data/prefill-and-stop-sequences.md),
which prefilled the assistant turn with a markdown fence (` ```json `) to trap
generation inside a code block. That's one instance of a more general idea: the
prefill can be **any** text that makes Claude believe it already started
responding in a particular shape — not just fence syntax, and not just a short
marker either.

## The prefill is a whole sentence

````js
addUserMessage('Generate three different sample AWS CLI commands. Each should be very short.');
addAssistantMessage('Here are all the 3 samples in a single block and with no comments:\n ```bash');
````

Instead of a bare marker like ` ``` ` or `1.`, the prefill is a full,
natural-language sentence that asserts its own constraints — "in a single
block", "with no comments" — followed by an opening fence. Claude continues
from there as if it already committed to that framing: it writes the
commands and doesn't add commentary, because as far as it's concerned, it
already promised not to.

This is a more literal answer to the hint that prefilling isn't limited to
characters like `` ` `` — the prefill content here is prose, not syntax.

## The stop sequence's job, here vs. the numbered-list attempt

An earlier version of this exercise prefilled a bare `1.` and used
`stop_sequences: ['4.']` — there, the stop sequence's job was to **guard a
count**: stop before a fourth item could exist. In the version here,
`stop_sequences: ['```']` marks the **literal end of content**, the same
role it played in exercise 05's JSON/CSV example — it cuts generation the
instant Claude tries to close the fence it opened.

## This doesn't guarantee three items

Tested this prefill against the real API across 6 runs: 5 produced all
three commands; 1 produced only `aws s3 ls` before Claude closed the fence.
Nothing here enforces a minimum count — the sentence says "3 samples," and
usually Claude honors that, but the stop sequence only fires once the fence
closes, whatever is inside it at that point. The numbered-list + `4.`
version guarantees "no more than three" structurally; this version doesn't
have an equivalent guarantee for "no fewer than three." A prefill that
narrates the desired format is stronger at suppressing commentary, but
weaker at enforcing quantity, than a prefill built around a counting
convention.

## Reconstructing the full response

Unlike 05's JSON/CSV example, this version doesn't need to glue anything
back onto the front — the prefilled sentence was scene-setting, not part of
the payload the caller wants, so `console.log(text)` alone is the complete
useful output.
