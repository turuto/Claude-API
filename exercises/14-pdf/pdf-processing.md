# PDF processing

## Message structure

A PDF is a `document` content block, sitting alongside a text block exactly
like image blocks did in 13 — same message shape, different block:

```js
{
  role: 'user',
  content: [
    { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64String } },
    { type: 'text', text: 'Summarize the document in one sentence' },
  ],
}
```

## Diff from image processing (13)

| | Image | PDF |
|---|---|---|
| Block `type` | `image` | `document` |
| `media_type` | `image/png` (etc.) | `application/pdf` |
| Encoding | base64, same as PDF | base64, same as image |

Everything else — the base64-encoding step, the helper functions
(`addUserMessage`/`chat`/`textFromMessage`), the request/response flow — is
identical to image processing.

## What Claude can extract

Not just rendered text — Claude reads the document holistically:

- Text content throughout the document
- Images and charts embedded in the PDF
- Tables and the relationships between their data
- Document structure and formatting

So a single request can answer things that would otherwise need separate
text-extraction and image-analysis passes (e.g. "what does this chart on
page 3 show, and how does it relate to the table on page 5?").
