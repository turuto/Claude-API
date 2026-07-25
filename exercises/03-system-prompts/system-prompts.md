# System prompts

## Theory

Every message in the `messages` array is either a `user` turn or an
`assistant` turn — there's no room in that list for instructions about _how_
Claude should behave overall. The Messages API has a separate top-level
`system` parameter for exactly that: a block of text that sets Claude's role,
constraints, or tone for the entire conversation, sent alongside `messages`
on every request but never stored as one of the turns itself.

Builds on [02 — multi-turn conversations](../02-conversation-claude/multi-turn-conversations.md)
by adding a `system` prompt on top of the same history-accumulating loop —
the `chat` function now sends the tutor persona with every call in addition
to the growing `messages` array.

## The `system` parameter

```js
const systemPrompt = `You are a Math Tutor.
Don't give final answers. Only give hints, and guide the user towards the solution
Never tell the user to use a calculator.
If he gets stuck, explain the next step.
Don't answer anything that is not related.`;

const params = {
    model: 'claude-opus-4-8',
    max_tokens: 1024,
    messages,
};

if (systemPrompt) {
    params.system = systemPrompt;
}
```

- `system` is a plain string (or array of content blocks for more advanced
  cases like caching), passed as a sibling of `messages` in the request body
  — not a message with a `role`.
- Because it's resent on every call, the persona/constraints stay in force
  for the whole conversation without needing to be repeated inside each user
  message.
- `chat` takes `systemPrompt` as a parameter and only sets `params.system`
  when one is passed in. That's deliberately conditional here to show the
  API accepts requests with or without a `system` prompt — a stricter version
  of `chat` for a single fixed persona wouldn't need the `if` at all.

## Prompting technique: hints, not answers

The example persona (a math tutor that must never give the final answer)
demonstrates that a system prompt can shape _how_ Claude solves the problem,
not just its tone — here, forcing it into a Socratic, one-step-at-a-time
style regardless of how directly the user asks for the answer.

## Still one persona per run

`systemPrompt` here is a single hardcoded string set once at the top of the
file. Swapping personas mid-conversation, loading prompts from a file, or
combining multiple instruction blocks are possible extensions, not covered
by this exercise.
