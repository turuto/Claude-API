# Implementing the RAG flow: chunk → embed → store → search

`rag-pipeline-walkthrough.md` walked through the RAG flow conceptually, with toy 2D vectors.
This is the same five steps, but as actual code against the real `report.md` and real
embeddings — the shape `index.js` is meant to grow into.

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

## Step 2 — batch-generate embeddings

The lesson's `generate_embedding` is upgraded to accept either a single string or a list of
strings, so all chunks can be embedded in one call instead of one at a time:

```python
embeddings = generate_embedding(chunks)
```

`index.js`'s `generateEmbedding` doesn't do this yet — it only takes one string. VoyageAI's
`embed()` already accepts an array for `input` (see the `EmbedRequest` type: "a single text
string, or a list of texts"), so batching is a matter of accepting an array and mapping over
`response.data` instead of just returning `response.data[0].embedding` — worth doing once this
file actually needs to embed more than one chunk at a time.

## Step 3 — store in a vector index

```python
store = VectorIndex()

for embedding, chunk in zip(embeddings, chunks):
    store.add_vector(embedding, {"content": chunk})
```

**Store the original text alongside the embedding, not just the vector.** The embedding is
only useful for _finding_ the right chunk — once you've found it, you need the actual text to
put in the prompt. `{"content": chunk}` is exactly that: a place to keep the chunk text attached
to its own embedding so retrieval can return something Claude can actually read.

> **Not yet implemented:** the lesson uses `VectorIndex` as a given (imported utility), showing
> only how it's used (`add_vector`, `search`) — not how it stores vectors or computes distance
> internally. Once we have that implementation (or decide to write our own small in-memory
> version), `index.js` can build a real version of this step. Until then, treat `add_vector` /
> `search` below as the target interface, not something already working here.

## Step 4 — embed the question

Exactly the existing `generateEmbedding`, just called on the user's question instead of a
document chunk:

```python
user_embedding = generate_embedding("What did the software engineering dept do last year?")
```

(Should use `inputType: 'query'` per `semantic-search-and-embeddings.md` — `generateEmbedding`
already defaults to that.)

## Step 5 — search

```python
results = store.search(user_embedding, 2)

for doc, distance in results:
    print(distance, "\n", doc["content"][0:200], "\n")
```

`search` takes the query embedding and how many results to return (`k`), and gives back
`(doc, distance)` pairs — `doc` is the metadata dict from step 3 (so `doc["content"]` is the
original chunk text), and `distance` is cosine distance (`1 - cosine similarity`, per
`rag-pipeline-walkthrough.md` — lower means more similar).

## Reading real results

Querying "What did the software engineering dept do last year?" against the real `report.md`
returns:

1. **Section 2: Software Engineering** — distance `0.71` (closest match)
2. **Methodology** — distance `0.72` (second closest)

Section 2 wins, as expected. The Methodology section coming in a close second makes sense too —
it's the other section that talks about how the report's contents were assembled, which shares
some vocabulary with a "what did X department do" question even though it isn't the right
answer.

## Where this breaks down

This basic version works for a lot of cases, but not all — the next lessons look at making
retrieval more robust. The core idea underneath all of it, though, doesn't change: RAG is about
turning text into numbers, storing those numbers so they can be searched efficiently, and using
mathematical similarity — not exact word matching — to decide what's relevant to a question.
