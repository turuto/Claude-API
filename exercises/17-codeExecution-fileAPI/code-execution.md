# Code Execution

A server-side tool (same family as web search in 10i): declare it in `tools`, and Claude can
choose to run Python in an isolated container without any client-side tool loop to write.

```js
tools: [{ type: 'code_execution_20260521', name: 'code_execution' }];
```

`_20260521` is the current tool version at the time this exercise was written (adds REPL
state persistence over earlier versions) — the lesson's Python example uses the older
`code_execution_20250522`, which still works but doesn't persist state between calls the same
way. Unlike the web search tool versions in 10i, this one is GA rather than beta on the SDK
version this project pins, so it's declared through the regular `client.messages.create`, not
`client.beta.messages.create`.

## What the container looks like

- Isolated Docker container, **no network access** — the Files API (see `files-api.md`) is
  the only way to get data in or generated files out.
- Claude can execute code multiple times within a single response, iterating on its own
  output (e.g. run some exploratory code, see the result, then write the actual analysis).
- Comes with common Python data libraries pre-installed (pandas, numpy, matplotlib, etc.) —
  no environment setup needed in the prompt.

## Reading the response

The `code_execution` tool doesn't itself show up as a `server_tool_use` name — declaring it
gives Claude access to two sub-tools, and it's *those* names that appear in the response:

| Block type                          | What it is                                                          |
| ------------------------------------ | --------------------------------------------------------------------- |
| `text`                                | Claude's running commentary / final answer                            |
| `server_tool_use` (`bash_code_execution`) | A shell command Claude ran (`block.input.command`)                 |
| `server_tool_use` (`text_editor_code_execution`) | A file operation, e.g. writing a script (`block.input.command`, `.path`) |
| `bash_code_execution_tool_result`     | The shell command's output                                            |
| `text_editor_code_execution_tool_result` | The file operation's result                                        |

This tripped me up while writing this exercise: the SDK's types also define a *generic*
`code_execution_tool_result` / `server_tool_use { name: 'code_execution' }` shape, which reads
as if it should be what comes back — but against the real API with the `_20260521` tool
version, every call arrives as `bash_code_execution` or `text_editor_code_execution` instead.
Don't trust a block-type name from the SDK's type definitions alone; log
`response.content.map(b => b.type)` from a real response once and match against that.

`bash_code_execution_tool_result.content` is a discriminated union — either
`bash_code_execution_tool_result_error` (check `.error_code`) or a successful result carrying
`stdout`, `stderr`, `return_code`, and a `content` array of any files the command wrote
(`{type: 'bash_code_execution_output', file_id: '...'}`). Downloading those is the Files
API's job — see `files-api.md`.

## Container reuse

The response includes a `container` field (`{id, expires_at}`). Passing that ID back on a
later request (`client.messages.create({ container: containerId, ... })`) resumes the *same*
container — same installed packages, same files on disk — instead of spinning up a fresh one.
Not used in this exercise's single-request flow, but worth knowing for a multi-turn analysis
session.
