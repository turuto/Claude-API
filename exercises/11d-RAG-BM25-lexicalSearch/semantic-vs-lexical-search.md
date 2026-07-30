# Semantic search vs. lexical search, and BM25

## The problem: semantic search alone misses exact matches

Semantic search (11b/11c) is great at understanding _meaning_ — it'll find a section about
"leg exercises" for a question about "quad workouts" even with zero word overlap. But that
same strength is a weakness for exact lookups: search for a specific incident ID like
`INC-2023-Q4-011`, and semantic search might return a **financial analysis** section that's
conceptually adjacent (both are "incident-adjacent business content") but never actually
mentions that ID — while under-ranking the cybersecurity section that does contain it. Semantic
search matches on _concepts_, not _literal tokens_, so it has no special respect for an exact
string match.

## The distinction: semantic vs. lexical

|                   | Semantic search (11b/11c)                                          | Lexical search (this exercise)                          |
| ----------------- | ------------------------------------------------------------------ | ------------------------------------------------------- |
| What it compares  | Embeddings — numerical vectors capturing meaning                   | Literal tokens — the actual words/terms in the text     |
| Good at           | Conceptual/paraphrased matches ("leg exercises" ≈ "quad workouts") | Exact terms: IDs, error codes, names, specific phrases  |
| Blind spot        | Doesn't specially favor an exact string match                      | Doesn't understand synonyms or paraphrasing at all      |
| How it works here | `generateEmbedding` (VoyageAI) + cosine distance (`VectorIndex`)   | Token overlap + frequency weighting (BM25, `BM25Index`) |

Neither approach is strictly better — they fail in complementary ways. **Hybrid search** runs
both in parallel and merges the results, so a query gets the benefit of both: semantic search's
conceptual reach, and lexical search's precision on exact terms. (Merging the two result sets
is the next lesson — this one only implements the lexical half.)

## What BM25 is, roughly

BM25 ("Best Match 25") is the standard algorithm for lexical search — it scores how well a
document matches a query using nothing but term statistics, no meaning involved. Four
conceptual steps:

1. **Tokenize the query** — break it into individual terms.
2. **Count document frequency** — for each term, how many documents in the corpus contain it at
   all (not how many times — just whether it shows up anywhere in that document).
3. **Weight by rarity (IDF — inverse document frequency)** — a term that shows up in almost
   every document (like "the") contributes almost nothing to relevance; a term that shows up in
   only one or two documents (like an incident ID) is a strong, specific signal.
4. **Score and rank** — for each document, sum up (term frequency in that document) × (the
   term's IDF weight) across the query's terms, with two adjustments: diminishing returns for a
   term appearing many times in one document (`k1`), and normalizing for document length so
   long documents don't win purely by containing more words overall (`b`). `BM25Index` in
   `index.js` is a direct translation of the lesson's Python (`004_bm25.ipynb`) implementing
   exactly this.

## The real tokenizer is less literal than the lesson's example

The lesson's prose example simplifies: "a INC-2023-Q4-011" becomes `["a", "INC-2023-Q4-011"]`
— one token per "word", ID kept intact. The actual default tokenizer (`_defaultTokenizer` in
`index.js`) lowercases everything and splits on **any run of non-word characters**, which
includes hyphens — so `INC-2023-Q4-011` actually tokenizes into `["inc", "2023", "q4", "011"]`,
four separate tokens, not one. BM25 still gets the right answer here because those four
fragments are collectively still rare across an unrelated corpus (nothing else in `report.md`
talks about "q4" _and_ "011" _and_ "inc" together) — but it's worth knowing the real tokenizer
is a blunt `\W+` split, not something ID-aware.

## Score direction: normalized to match `VectorIndex`

Raw BM25 scores are "higher = more relevant" — the opposite convention from `VectorIndex`'s
cosine distance, where "lower = more similar". `search()` normalizes with
`exp(-scoreNormalizationFactor * rawScore)`, which flips the direction so a higher raw score
produces a _lower_ normalized score. That's not cosmetic — it means BM25 results and semantic
search results end up on the same "lower is better" scale, which is exactly what's needed to
merge and re-rank both result sets together in the next lesson.

## `k1` and `b`

- **`k1`** (default `1.5`) controls term-frequency saturation: how much each additional
  occurrence of a term in a document keeps adding to the score. Without a cap, a document that
  repeats a query term 50 times would dominate regardless of actual relevance.
- **`b`** (default `0.75`) controls document-length normalization, from `0` (ignore length
  entirely) to `1` (fully normalize) — without it, a long document would tend to score higher
  just by containing more words, independent of relevance.

These are the standard Okapi BM25 defaults, not something tuned for `report.md` specifically.

## Real results

Searching `report.md` for `"What happened with INC-2023-Q4-011?"` (k=3):

1. **Section 2: Software Engineering** — score `0.271` (closest match; the incident is
   discussed here as the root-cause/fix side of the story)
2. **Section 10: Cybersecurity Analysis: Incident Response Report: INC-2023-Q4-011** — score
   `0.332` (contains the literal ID, and is the section named after it)
3. **Methodology** — score `0.939` (far behind — matches only on common words, not the ID)

Both of the top two results actually mention `INC-2023-Q4-011` — exactly the outcome semantic
search alone struggled with, and exactly what the lesson predicts: BM25 prioritizes documents
that contain the specific, rare terms in the query, not documents that are merely
conceptually adjacent to them.
