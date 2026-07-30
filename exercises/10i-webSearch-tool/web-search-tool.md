# The web search tool

Another built-in tool, but a different flavor from 10h's text editor tool. The text editor
tool is **client-side**: Claude asks, we execute the file operation, we send a `tool_result`
back. Web search is **server-side**: Anthropic's own infrastructure runs the search(es) and
folds the results straight into the same response. There's no `tool_use` block for us to act
on and no loop to write — the schema in `index.js` is the entire implementation.

## Enabling it

Web search has to be turned on for the organization first, in the Console at
[console.anthropic.com/settings/privacy](https://console.anthropic.com/settings/privacy). A
request with the tool declared but the org setting off fails outright — it doesn't silently
skip searching.

## Schema fields

```js
{
  type: 'web_search_20260209',
  name: 'web_search',
  max_uses: 5,             // caps how many searches Claude can run in one turn
  allowed_domains: ['nih.gov'],  // or blocked_domains, user_location
}
```

`max_uses` limits _searches_, not _results_ — one search can return several
`web_search_result` hits, and Claude may decide to run several searches (e.g. to refine a
query) before answering, so this is the guardrail against runaway API cost.

## Claude decides on its own — you can't force it

With `tool_choice` left at its default (`auto`), Claude only searches when it judges that
current or specialized information would actually help — a question it can answer confidently
from training data may get answered directly, with no search at all. Unlike custom tools,
you also **can't force it** with `tool_choice: {type: "tool", name: "web_search"}`: the API
rejects that outright with _"this tool only allows calls from ['code_execution_20260120']...
must allow 'direct' calls from the model."_ The only way to reliably see a search happen is to
phrase the prompt so a search is clearly the better path (e.g. asking for research published
"this year" instead of a generic question the model likely already knows the answer to).

## Response block types

The lesson names five kinds of thing that can show up in the response; here's each one against
the actual `block.type` string you see on the wire:

| Lesson's name            | `block.type`                                                               | What it is                                                                                                                                                                                                                                                                                          |
| ------------------------ | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Text blocks              | `text`                                                                     | Claude's explanation of what it's doing / its final answer.                                                                                                                                                                                                                                         |
| ServerToolUseBlock       | `server_tool_use`                                                          | Shows the exact search query Claude used (or, on the current tool version, the filtering code — see below).                                                                                                                                                                                         |
| WebSearchToolResultBlock | `web_search_tool_result`                                                   | Contains the search results for one search. `content` is an **array** of WebSearchResultBlocks on success — or a single **error object** (`{error_code: ...}`) on failure. It's a 200 either way; check `Array.isArray(block.content)` before assuming success, since a failed search never throws. |
| WebSearchResultBlock     | `web_search_result`                                                        | One individual search result, with `title`, `url`, and `page_age` — these are the items inside a WebSearchToolResultBlock's `content` array.                                                                                                                                                        |
| Citation blocks          | `web_search_result_location` (found in a `text` block's `citations` array) | The specific text that supports one of Claude's statements, tied back to its source via `title`, `url`, and the `cited_text` it backs.                                                                                                                                                              |

## Tool version and dynamic filtering

`web_search_20250305` (what the lesson notebook uses) is the older, simpler version — one
`server_tool_use` block per search, straight to `web_search_tool_result`. Current models
(including this project's default, `claude-opus-4-8`) support `web_search_20260209`, which
adds **dynamic filtering**: Claude writes and runs a small script in the code execution
sandbox that calls `web_search()` itself, filters results, and only surfaces what's relevant.
That means the response can contain a `server_tool_use` block for `code_execution` (the
filtering script) _and_ nested `server_tool_use` blocks for `web_search` with a `caller` field
pointing back to it — not just one flat search-per-block like the older version. Dynamic
filtering activates automatically with no separate `code_execution` tool declaration and no
beta header; `index.js`'s rendering loop branches on `block.name` to handle both shapes.

This also means a single turn can run noticeably longer than a plain API call — Claude may
fire off several search queries inside that sandboxed script before it's done — so budget more
patience (and `max_tokens`) than a typical non-tool request.

**Observed in practice:** with dynamic filtering, text blocks don't reliably come back with a
populated `citations` array, even when Claude is clearly paraphrasing a specific source. Citations
depend on an exact substring match between the model's text and the raw search result content —
once results get routed through Claude's own filtering script instead of coming straight from the
search API, that exact correspondence can break. `web_search_20250305` (no dynamic filtering)
doesn't have this problem. Don't assume `citations` will be there; render it when present, but
build the "which sources did this answer use" list from the `web_search_tool_result` blocks
either way.
