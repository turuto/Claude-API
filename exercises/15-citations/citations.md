# Citations

## Why

Without citations, a document-grounded answer is a black box — there's no way for a user to tell
whether Claude is quoting your source or its training data. Citations add a trail from each claim
back to the exact passage that supports it.

## Enabling it

Two extra fields on the `document` block from 14:

```js
{
  type: 'document',
  source: { type: 'base64', media_type: 'application/pdf', data: fileBytes },
  title: 'earth.pdf',
  citations: { enabled: true },
}
```

`title` is a readable name Claude uses to refer to the document in citation metadata.
`citations: { enabled: true }` turns on tracking.

## What comes back

With citations off, a response is flat text. With them on, each text block carries its own
`citations` array — `null`/empty for sentences not grounded in the source, populated for ones that
are:

```js
{
  type: 'text',
  text: "Earth's atmosphere and oceans formed through volcanic activity and outgassing.",
  citations: [
    {
      type: 'page_location',       // 'char_location' for plain-text sources
      cited_text: "Earth's atmosphere and oceans were formed by volcanic activity and outgassing.",
      document_index: 0,
      document_title: 'earth.pdf',
      start_page_number: 5,
      end_page_number: 6,
    },
  ],
}
```

## PDF vs. plain text

|                 | PDF (`source.type: 'base64'`)                             | Plain text (`source.type: 'text'`)   |
| --------------- | --------------------------------------------------------- | ------------------------------------ |
| Citation `type` | `page_location`                                           | `char_location`                      |
| Location fields | `start_page_number`, `end_page_number` (end is exclusive) | `start_char_index`, `end_char_index` |

Same `document` block shape either way — only the `source` and the resulting citation's location
fields differ. This exercise asks the same question against the same underlying content (a
Wikipedia excerpt on Earth) once as a PDF and once as plain text, so the two demos are directly
comparable.

## This exercise's two demos

1. **PDF citations** — `pdfs/earth.pdf`, citing by page number.
2. **Plain-text citations** — the same article as an inline string, citing by character offset.

Both print their answer to the console, then get rendered into a shared HTML report
(`output/citations.html`, regenerated on every run) where each cited sentence gets a hoverable
superscript marker. Hovering (or tabbing to, for keyboard users) a marker shows the exact quoted
source passage and its location — a minimal version of the "hover to see where this came from" UI
the lesson describes.
