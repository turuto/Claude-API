# Prompt engineering, in short

This is the theory behind the loop this project runs. If you only read one
section, read "The iteration loop" — it's the mindset; the four tips below
are just things to try inside it.

## The iteration loop

Prompt engineering is a cycle, not a one-shot guess:

1. **Set a goal** — what should the prompt accomplish?
2. **Write a first attempt** — plain, even deliberately bare. That's what's
   in `index.js` right now.
3. **Score it** — run the prompt against a set of test cases and grade the
   results. That's what `npm start` does.
4. **Change one thing** — apply a single, specific technique (see below).
5. **Score it again** — confirm the score actually moved before keeping the
   change.

Repeat steps 4-5 until the score is good enough. The one rule that matters
most: change **one thing at a time**. Change three things between runs and
the score improves, and you don't know which change did the work — or
whether one change helped while another quietly hurt.

## Don't be discouraged by a low first score

A bare prompt — just the raw facts, no guidance, no example — routinely
scores low against a rigorous grader. That's expected, not a sign something
is broken. The number is only useful once you have a second number, from a
revised prompt, to compare it against.

## Four tips, in the order to try them

### 1. Be clear and direct

The first line of a prompt does the most work — it's where Claude decides
what task it's even doing before it reads anything else.

- **Clear** — plain language, name the thing you want directly.
- **Direct** — an instruction, not a question. Open with an action verb
  (_Write_, _Generate_, _Identify_), not a lead-in like "Could you...".

"What should I say back to this customer?" leaves the action, the format,
and the constraints all for Claude to guess. "Write a customer support
email reply to the message below." states all three. Try this first —
every other tip below assumes Claude already understands the task.

### 2. Be specific

Left unconstrained, Claude has to guess at things you actually care about —
length, tone, what must be included. A numbered list of guidelines closes
that gap cheaply:

```
Guidelines:
1. Greet the customer by name
2. Acknowledge their specific issue
3. Clearly state what will happen next
4. Keep a warm, professional tone
```

This is usually the single biggest score jump of the four techniques here —
often worth trying right after tip 1, before anything else.

### 3. Structure input with tags

When a prompt mixes instructions with real data — especially several
distinct pieces of it — wrap each piece in a descriptive tag so Claude
doesn't have to guess where one section ends and another begins:

```
<customer-message>
    - Name: Priya
    - Issue: Received a damaged blender
</customer-message>
```

The tags don't need to be "real" XML — invented names are fine, as long as
they're specific to what they wrap. The gain is modest for a short block
like this one; it matters more the larger and more mixed a prompt's data
gets.

### 4. Provide an example

Showing Claude one sample input paired with an ideal output often teaches
format, tone, and edge cases more reliably than describing them in prose.
When adding one:

- Say plainly what you're showing ("Here is an example of ideal output").
- Wrap the pair in tags, same idea as tip 3.
- Add a sentence on *why* the example is good — the reasoning transfers
  better than the raw example alone.
- Where possible, reuse a real output that already scored well against
  your own grader, rather than writing one from scratch.

Watch out: a single example can backfire if real requests are more varied
than the example. Claude can anchor too hard on that one scenario's
specifics instead of generalizing — if that happens, adding a second,
different example usually helps more than removing the first.

Examples are the most expensive of the four to write and maintain, so
they're usually the last thing reached for — after the opening line, the
guidelines, and the input structure are already in place.

## See it applied

[SOLUTION.md](./SOLUTION.md) walks through applying tips 2-4 to this
project's own starting prompt, with the before/after text for each step.
