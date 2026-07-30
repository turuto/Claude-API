# The complete RAG pipeline, worked example

`introduction-to-rag.md` covers why RAG exists, and `semantic-search-and-embeddings.md` covers
what an embedding is. This ties both together with the one piece still missing —
**how you actually pick the right chunk** — using a small worked example instead of the full
`report.md`.

Two toy sections, deliberately chosen so a naive keyword search would fail exactly the way
`introduction-to-rag.md` warned about:

- **Section 1 (Medical Research):** "This year saw significant strides in our understanding of
  XDR-47, a 'bug' we have not seen before."
- **Section 2 (Software Engineering):** "This division dedicated significant effort to
  studying various infection vectors in our distributed systems."

Section 1 literally contains the word "bug"; Section 2 talks about "infection vectors" — the
two sections read almost like they're about the same thing if you're matching on words instead
of meaning.

## Step 1 — chunk the source text

Same idea as `chunkBySection` from 11a — the two sections above are already the "chunks" here.

## Step 2 — generate embeddings

Same `generateEmbedding()` call as 11b, but for intuition, imagine a toy embedding model that
always returns exactly two numbers, and we know what they mean: the first is "how much this
text talks about medicine," the second is "how much this text talks about software
engineering." (Real embeddings, like the 1024-dimension vectors from `voyage-3-large` in 11b's
`index.js`, work the same way — you just can't read the dimensions individually, per
`semantic-search-and-embeddings.md`.)

- Medical Research chunk → `[0.97, 0.34]` — mostly medical, but "bug" pulls the software
  number up a little
- Software Engineering chunk → `[0.30, 0.97]` — mostly software, but "infection vectors" pulls
  the medical number up a little

## Normalization

Embedding APIs scale every vector to a magnitude of 1.0 automatically — nothing to implement,
just something to know is happening under the hood. The two chunks above become:

- Medical Research → `[0.944, 0.331]`
- Software Engineering → `[0.295, 0.955]`

Picture these as points on a unit circle (in the real, 1024-dimension case it's a hypersphere,
but the geometry that matters — comparing directions — works the same way).

## Step 3 — store in a vector database

A vector database is just a database built for storing and searching long lists of numbers
efficiently. Everything up to this point — chunking, embedding, storing — is **preprocessing**
that happens once, ahead of time, before any user has asked a question.

## Step 4 — embed the user's query

This is where `inputType` from `semantic-search-and-embeddings.md` actually matters: chunks get
embedded with `inputType: 'document'` during preprocessing, but a live user question gets
embedded with `inputType: 'query'` — same embedding model, different mode, because the two
serve different roles in the comparison that's about to happen.

A question like "I'm curious about the company. In particular, what did the software
engineering dept do this year?" might embed to `[0.1, 0.89]` → normalized to `[0.112, 0.993]` —
low medical score, high software score, same as the Section 2 chunk's shape.

## Step 5 — find the most similar embedding: cosine similarity

The vector database ranks its stored embeddings against the query embedding using **cosine
similarity** — the cosine of the angle between two vectors.

- Ranges from -1 to 1
- Close to **1** → highly similar (pointing the same direction)
- Close to **0** → unrelated (perpendicular)
- Close to **-1** → opposite

In this example: query vs. the Software Engineering chunk → **0.983** (very high); query vs.
the Medical Research chunk → **0.398** (much lower). The database returns the Software
Engineering chunk — correctly, even though the Medical Research chunk contains the literal
word "bug" that a keyword search would have latched onto.

**Cosine distance**, which shows up a lot in vector DB docs, is just `1 - cosine similarity` —
flips the scale so 0 means most similar and larger numbers mean less similar, which some people
find more intuitive than "closer to 1 is better."

## Step 6 — build the final prompt

Take the user's original question and _only_ the winning chunk (not the whole document — that
was the entire point of chunking) and drop them into the same template shape
`introduction-to-rag.md` used for the naive "stuff everything in" approach — except now
`<report>` holds one retrieved section instead of 800 pages:

```
Answer the user's question about the financial document.

<user_question>
How many bugs did engineers fix this year?
</user_question>

<report>
## Section 2: Software Engineering
This division dedicated significant effort to studying various infection vectors in our distributed systems
</report>
```

That's the whole pipeline: chunk ahead of time, embed each chunk, store the embeddings, embed
the incoming question the same way, rank stored chunks by cosine similarity against it, and
hand Claude only the winner. The "bug" scenario from `introduction-to-rag.md` isn't just a
cautionary example anymore — this is the mechanism that avoids it.
