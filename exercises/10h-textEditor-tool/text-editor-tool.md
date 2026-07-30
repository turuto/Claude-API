# The text editor tool

Every tool through 10g was one we defined ourselves: a name, a description, a JSON
`input_schema`, and a function we wrote to run it. The text editor tool is different — it's
one of a handful of tools **built into Claude**. Claude already has the full schema and
knows how and when to call `view`, `str_replace`, `create`, and `insert` memorized; the only
thing we send over the wire is a tiny stub identifying which version of the tool to use:

```js
{ type: 'text_editor_20250728', name: 'str_replace_based_edit_tool' }
```

No `input_schema` — Claude expands that stub into the full tool spec on its side.

## What we still have to write

Claude can *ask* to view or edit a file, but it has no filesystem of its own — every request
still comes back as an ordinary `tool_use` block, and it's still on us to actually read/write
the file and return a `tool_result`. That's what `text-editor-tool.js` does: a small
`TextEditorTool` class with one method per command, kept in its own file since the whole
point is that this implementation is reusable across any Claude-powered app, independent of
the conversation loop that drives it.

## Schema version is tied to the model

The tool `type` string (and its matching `name`) changes across model generations — getting
the two out of sync is a 400, they're not independent fields:

- Claude 3.5 Sonnet — `text_editor_20241022` + `str_replace_editor`
- Claude 3.7 Sonnet — `text_editor_20250124` + `str_replace_editor`
- Claude 4+ (including this project's default, `claude-opus-4-8`) — `text_editor_20250728` +
  `str_replace_based_edit_tool`

The current list of version strings per model is always at
[docs.anthropic.com/en/docs/agents-and-tools/tool-use/text-editor-tool](https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/text-editor-tool) —
worth checking there instead of trusting this file whenever a new model ships.

## `undo_edit` is gone on Claude 4+

The original version of this lesson's tool implementation included an `undo_edit` command
backed by a backup/restore mechanism (copy the file before every edit, restore the latest
copy on request). That command was removed from the tool spec on Claude 4+ models — Claude
will never emit it against `text_editor_20250728` — so there's nothing to back up and nothing
to restore. `TextEditorTool` here only implements the four commands the current tool version
actually supports.

## Sandboxing

`path` in every tool call is untrusted model output. `TextEditorTool` resolves every path
against a fixed `baseDir` (`./sandbox`) and throws if the result would land outside it —
otherwise a prompt-injected or hallucinated `../../etc/passwd` would be a real path traversal,
not just a bug.
