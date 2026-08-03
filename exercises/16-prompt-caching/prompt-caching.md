# Prompt caching

## Why

Every request to Claude starts with preprocessing (tokenizing, embedding, context analysis)
before any output is generated, and normally that work is thrown away the moment the response is
sent. If you're about to send largely the same content again — the same system prompt, the same
tool schemas, the same long document — that's wasted work. Prompt caching stores it so a
follow-up request can read it back instead of redoing it: faster responses, and the cached
portion of the input is billed at a fraction of the normal rate.

## Cache breakpoints

Caching is not automatic — you mark where cacheable content ends by adding a breakpoint to a
content block:

```js
{ type: 'text', text: someLongText, cache_control: { type: 'ephemeral' } }
```

Everything up to and including the breakpoint gets cached; anything after it is processed
normally. This is why a cacheable system prompt has to use the longhand array-of-blocks form
instead of a plain string — the string shorthand has no field to hang `cache_control` off of:

```js
// Not cacheable — no field to attach cache_control to:
params.system = 'You are a helpful assistant.';

// Cacheable:
params.system = [{ type: 'text', text: 'You are a helpful assistant.', cache_control: { type: 'ephemeral' } }];
```

The same field works on tool definitions and message content blocks (text, image, tool_use,
tool_result) — anywhere a block can appear.

## The rules

- **Exact match required.** The cache only hits if the content up to the breakpoint is
  byte-for-byte identical to a previous request. Changing even one word (adding "please")
  invalidates it — there's no partial credit, and a miss is a normal cache write, not an error.
- **1024-token minimum.** Content shorter than that is never cached, breakpoint or not. This is
  the sum of everything up to the breakpoint, not any one block in isolation.
- **1-hour TTL.** A cache entry not read again within an hour of its last write expires.
- **Wire order is fixed:** tools, then system prompt, then messages. Breakpoints are evaluated in
  that order, which matters when you're caching more than one section at once (demo 4 caches the
  growing message history; nothing here also caches tools or system, but the order still applies
  if you combine them).
- **Up to 4 breakpoints per request.** Enough to cache tools, a system prompt, and still have
  breakpoints left over to mark growing points in a conversation.

## What the response tells you

`response.usage` reports which happened:

| Field                         | Meaning                                          |
| ------------------------------ | ------------------------------------------------- |
| `cache_creation_input_tokens` | Tokens just written to the cache (a miss/cold write) |
| `cache_read_input_tokens`     | Tokens read back from an existing cache entry (a hit) |
| `input_tokens`                | Tokens processed normally — outside any breakpoint |

A request never shows both nonzero for the *same* content: it's either written fresh or read from
cache. But a single request can show both fields nonzero at once when it has multiple
breakpoints at different points in the conversation — some older content read from cache, some
newer content written fresh (see demo 4).

## Cross-message caching

A breakpoint isn't pinned to one message — placing it on the last block of the *latest* message
caches everything before it too, across however many prior user/assistant turns there are. That
means in a growing conversation, moving the breakpoint forward each turn lets you cache the whole
history-so-far, not just a fixed prefix chosen up front. Demo 4 does this: turn 1's breakpoint
keeps getting read on every later turn, and each new turn adds its own breakpoint extending the
cached prefix by one more turn.

## This exercise's four demos

1. **System prompt caching** — the same request sent twice; a cold write, then a cache read.
2. **Tool schema caching** — breakpoint on the last of five tool definitions; the user message
   changes between requests, but the tools cache still hits since only the tools need to match.
3. **Cache invalidation** — appending one sentence to the cached system prompt turns the second
   request back into a fresh write, proving there's no partial match.
4. **Cross-message caching** — a three-turn code-review conversation where each turn drops a new
   breakpoint on top of the last, so cache reads keep growing to cover more of the conversation
   as it goes.
