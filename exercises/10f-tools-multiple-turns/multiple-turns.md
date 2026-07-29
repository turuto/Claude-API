# Conversation with tools: an actual multi-turn session

`10e-tools-loopMultipleTools` proved the tool loop works, but only across
two independent, hardcoded questions with history reset in between. This
exercise takes the same `runConversation` and wires it into a real
interactive session — an `addUserMessage`/`chat`/readline loop, same shape
as `02b-conversation-claude` — so "multiple turns" means what a user would
actually expect: any number of back-and-forth exchanges, sharing one
continuously growing `messages` history, where each individual exchange can
itself take Claude through one or more tool calls before answering.

## The lesson's pseudocode has a bug

The lesson's `run_conversation` pseudocode reads:

```python
def run_conversation(messages):
    while True:
        response = chat(messages)

        add_user_message(messages, response)   # <- should be add_assistant_message

        if response isn't asking for a tool:
            break

        tool_result_blocks = run_tools(response)
        add_user_message(messages, tool_result_blocks)

    return messages
```

`response` is Claude's own reply — that has to go into history as the
**assistant** turn, not another user turn. Recording it as `user` would
leave the conversation with two consecutive user messages and no
assistant message at all, which the API rejects (roles must alternate).
`index.js` uses `addAssistantMessage(response)` here, exactly as `10e`
already did — this exercise didn't introduce that fix, it just carries it
forward while flagging where the lesson's own pseudocode diverges from
working code.

## Why a global `messages` array instead of passing it around

The lesson threads `messages` through every function as an explicit
parameter and has `run_conversation` return it at the end — ordinary
practice for a Python notebook cell with no persistent module state
between cells. This project has used a single shared `messages` array at
module scope since `02b-conversation-claude`, mutated in place by
`addUserMessage`/`addAssistantMessage` rather than passed around and
reassigned. `runConversation` here keeps that established shape rather than
switching to explicit parameter-threading now — same behavior, just
consistent with how every earlier exercise in this arc already works.

## What "multiple turns" adds over 10e

Nothing in the tool-handling logic changed from `10e` — same `TOOL_FUNCTIONS`
dispatch table, same `runTool`, same `runConversation` loop. The only
addition is the outer `while (true)` readline loop around it, and dropping
the `messages.length = 0` reset `10e` used between its two demo questions.
That means a follow-up question can now genuinely reference earlier
answers still sitting in history — e.g. asking "what day is 103 days from
today?" and then, in the same session, "and 30 days after that?", which
only works because the first exchange's tool calls and answer are still
part of `messages` when the second one starts.
