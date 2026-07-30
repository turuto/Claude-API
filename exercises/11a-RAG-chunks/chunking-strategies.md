# Chunking strategies

How a document gets split into chunks directly determines whether RAG works well or badly.
Bad chunking means irrelevant context gets pulled into the prompt, and Claude answers the
wrong question with confidence.

**The classic failure mode:** a document has sections on medical research and software
engineering. Someone asks "How many bugs did engineers fix this year?" If chunking is poor,
the retrieval step could surface the medical section instead — because it happens to contain
the word "bug" in a completely different context (an insect, a contaminant) than the software
sense the question meant.

## Size-based chunking

The simplest approach: split the text into fixed-length windows (e.g. a 325-character
document into three ~108-character chunks). Easy to implement, works on any document type —
but words get cut off mid-sentence, chunks lose context from their neighbors, and a header can
end up separated from the content it introduces.

**Overlap fixes the worst of this.** Each chunk repeats a few characters from the previous
one, so a word or sentence split at a boundary still shows up intact somewhere. `chunkByChar`
in `index.js` implements this: `chunkSize` controls the window, `chunkOverlap` controls how
much of the previous chunk's tail gets repeated at the start of the next.

## Structure-based chunking

Split along the document's own structure — headers, paragraphs, sections — instead of an
arbitrary character count. For Markdown, that means splitting on header markers (`\n## `).
This produces the cleanest, most meaningful chunks, since each one is a complete section. The
catch: it only works when the document's structure is actually reliable. Plenty of real-world
documents (plain text, PDFs) have no such guarantee.

`chunkBySection` in `index.js` implements this for report.md, which is Markdown with a known
heading structure — it wouldn't generalize to an arbitrary PDF.

## Semantic-based chunking

The most sophisticated approach, and the one not implemented here: split into sentences, then
use NLP to measure how related consecutive sentences are, grouping related ones into the same
chunk. Produces the most relevant chunks, but it's computationally expensive and meaningfully
more complex to build than the other three strategies — you need an actual model of sentence
meaning, not just string operations.

## Sentence-based chunking

A practical middle ground: split into individual sentences (a regex on sentence-ending
punctuation is usually enough), then group them into chunks of N sentences with overlap of one
or more sentences between consecutive chunks — same overlap idea as size-based chunking, just
operating on sentences instead of characters. `chunkBySentence` in `index.js` implements this.

## Choosing a strategy

- **Structure-based** — best results, but only when the document's formatting is actually
  guaranteed (e.g. internal reports you control the template for)
- **Sentence-based** — a solid middle ground for most plain-text documents
- **Size-based (with overlap)** — the most reliable fallback; works on literally any content,
  including code, and is what's most often reached for in production because it's simple and
  never breaks the pipeline, even if it's not always the most relevant chunking

There's no single best strategy — it depends on the documents, the use case, and how much
complexity is worth trading for chunk quality.

## Translating the notebook's regex to JS

Both `chunk_by_sentence`'s split pattern and `chunk_by_section`'s split pattern translate
directly — no workaround needed:

- Python's `re.split(r"(?<=[.!?])\s+", text)` → JS `text.split(/(?<=[.!?])\s+/)`. JS has
  supported lookbehind assertions since Node 9, so the "split after `.`/`!`/`?`, but keep the
  punctuation attached to the sentence before it" trick works unchanged.
- Python's `re.split(r"\n## ", document_text)` → JS `documentText.split(/\n## /)`. Both
  languages' plain (non-capturing-group) `split` drop the matched delimiter from the output,
  so the behavior lines up exactly — no leftover `## ` prefix on any chunk.
