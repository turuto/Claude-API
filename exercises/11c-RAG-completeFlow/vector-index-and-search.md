# Implementing the RAG flow: chunk → embed → store → search

`rag-pipeline-walkthrough.md` walked through the RAG flow conceptually, with toy 2D vectors.
This is the same five steps, implemented for real in `index.js` against the actual `report.md`
and real VoyageAI embeddings — including a full `VectorIndex` class translated from the
lesson's Python.

## The five steps

1. Chunk the text by section
2. Generate embeddings for each chunk
3. Create a vector store and add each embedding to it
4. Generate an embedding for the user's question
5. Search the store to find the most relevant chunks

Steps 1–3 are the preprocessing phase (same as `rag-pipeline-walkthrough.md`'s "we pause and
wait for a user query" moment). Steps 4–5 happen per question.

## Step 1 — chunk

Same `chunkBySection` already in `index.js` — nothing new here, just applied to the real
document instead of two toy sentences:

```python
with open("./report.md", "r") as f:
    text = f.read()

chunks = chunk_by_section(text)
```

## Step 2 & 3 — embed and store, in one batched call

`index.js`'s `generateEmbedding` is upgraded from 11b's version to accept either a single
string or an array of strings — same idea as the lesson's upgrade:

```python
embeddings = generate_embedding(chunks)
```

Rather than computing all the embeddings first and then looping `add_vector` calls (what the
lesson shows), `VectorIndex.addDocuments(documents)` does both at once: it pulls out each
document's `content`, sends the whole batch through `embeddingFn` in a single VoyageAI call,
and stores each resulting vector alongside its document. That's the same batching the lesson
calls out ("converted to a bulk operation to avoid rate limiting errors from VoyageAI") — the
notebook uses `add_documents` but never shows its implementation, so this is our own version of
it, built on top of the `add_vector` method the notebook does show:

```js
const store = new VectorIndex('cosine', generateEmbedding);
await store.addDocuments(chunks.map((chunk) => ({ content: chunk })));
```

**Store the original text alongside the embedding, not just the vector.** The embedding is
only useful for _finding_ the right chunk — once you've found it, you need the actual text to
put in the prompt. `{ content: chunk }` is exactly that: a place to keep the chunk text attached
to its own embedding so retrieval can return something Claude can actually read.

## The `VectorIndex` class

Translated directly from the lesson's Python (`003_vectordb.ipynb`) — a small in-memory store,
no external vector database needed for an example this size:

| Method                                              | What it does                                                                                                                                                                  |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `constructor(distanceMetric, embeddingFn)`          | `distanceMetric` is `'cosine'` (default) or `'euclidean'`. `embeddingFn` is what turns text into vectors for `addDocument(s)` and string queries to `search`.                 |
| `addVector(vector, document)`                       | Store a precomputed vector directly. Every stored vector's length must match the first one added — a mismatch throws.                                                         |
| `addDocument(document)` / `addDocuments(documents)` | Embed one document's (or many documents') `content` via `embeddingFn`, then `addVector` the result(s). `addDocuments` batches into one embedding call, `addDocument` doesn't. |
| `search(query, k)`                                  | Accepts either a query string (embedded via `embeddingFn`) or a precomputed vector. Returns the `k` closest stored `[document, distance]` pairs, nearest first.               |

Distance is computed with the same math as `rag-pipeline-walkthrough.md`: cosine distance is
`1 - cosine similarity`, so lower means more similar; Euclidean distance is plain straight-line
distance between the two vectors, offered as the class's other option.

## Step 4 & 5 — ask a question, search

Because the store was built with an `embeddingFn`, `search` can take the question as a plain
string and embed it internally — no separate `generateEmbedding` call needed the way the
lesson's narrative shows it:

```js
const results = await store.search('What did the software engineering dept do last year?', 2);

for (const [document, distance] of results) {
    console.log(distance, '\n', document.content.slice(0, 200), '\n');
}
```

## Reading real results

Querying "What did the software engineering dept do last year?" against the real `report.md`
with live VoyageAI embeddings returns:

1. **Section 2: Software Engineering** — distance `0.485` (closest match)
2. **Future Directions** — distance `0.489` (second closest)

Section 2 wins, as expected — matching the lesson's takeaway even though the exact numbers
differ from the lesson's own example (`0.71` / `0.72`, with Methodology as the runner-up
instead of Future Directions). That's expected, not a bug: these are live embeddings from the
current `voyage-3-large` model, not the exact snapshot the lesson's own run used, and Future
Directions references nearly every other section by name (including Software Engineering
twice), so it's a reasonable runner-up.

**One thing worth revisiting later:** both `generateEmbedding` and the lesson's own
`generate_embedding` default to `inputType: 'query'`, which per `semantic-search-and-embeddings.md`
is the wrong mode for the chunks being _indexed_ (they should use `'document'`) — `search`'s
internal query embedding is the one call where `'query'` is actually correct. The lesson's
example doesn't distinguish the two either, so this file doesn't yet — it still finds the right
answer, but tightening this up (passing `'document'` from `addDocuments`/`addDocument` and
`'query'` only from `search`) is a reasonable follow-up now that the mechanism is in place.

## Where this breaks down

This basic version works for a lot of cases, but not all — the next lessons look at making
retrieval more robust. The core idea underneath all of it, though, doesn't change: RAG is about
turning text into numbers, storing those numbers so they can be searched efficiently, and using
mathematical similarity — not exact word matching — to decide what's relevant to a question.
