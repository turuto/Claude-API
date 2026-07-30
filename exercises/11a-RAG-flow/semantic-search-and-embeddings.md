# Semantic search and text embeddings

## Why: finding relevant chunks is a search problem

Once a document is broken into chunks (11a), the next step in a RAG pipeline is figuring out
which chunks are actually relevant to a user's question. That's a search problem — look
through all the chunks and identify the ones that relate to what's being asked.

## Semantic search vs. keyword search

The standard approach is **semantic search**. Keyword search looks for exact word matches;
semantic search uses text embeddings to capture the _meaning_ of both the question and each
chunk, so it can match on what a chunk is actually about rather than which literal words it
contains.

## What a text embedding is

A numerical representation of the meaning in a piece of text — a way to turn words and
sentences into something a computer can compare mathematically.

1. Feed text into an embedding model
2. The model outputs a long list of numbers — the embedding (a vector)
3. Each number ranges from -1 to +1
4. Collectively, those numbers represent features of the input text

## The numbers aren't individually interpretable

Each number in the vector is effectively a "score" for some quality of the text — but which
quality is not something we know precisely. It's tempting to imagine one dimension means "how
happy is this text" or "how much does this mention oceans," but those are just illustrative
examples. What each dimension actually captures is learned by the model during training and
isn't directly readable by a human — you use the vector as a whole (via similarity, covered
next) rather than trying to interpret individual numbers.

## VoyageAI, since Anthropic doesn't do embeddings

Anthropic doesn't provide an embeddings endpoint — the lesson's recommended provider is
**VoyageAI**, a separate service from Anthropic:

- Sign up for a separate VoyageAI account
- Get an API key (free to start)
- Add it to `.env` alongside `ANTHROPIC_API_KEY`:

```
VOYAGE_API_KEY="your_key_here"
```

## The JS SDK vs. the lesson's Python

The lesson's Python: `pip install voyageai`, then

```python
client = voyageai.Client()  # reads VOYAGE_API_KEY from the environment, like Anthropic() does

def generate_embedding(text, model="voyage-3-large", input_type="query"):
    result = client.embed([text], model=model, input_type=input_type)
    return result.embeddings[0]
```

VoyageAI publishes an official `voyageai` package on npm (a Fern-generated TypeScript SDK).
`new VoyageAIClient()` with no arguments also reads `VOYAGE_API_KEY` from the environment
automatically — same convention as `new Anthropic()` — but the call shape differs from the
Python client in a few ways worth knowing before translating it:

```js
import { VoyageAIClient } from 'voyageai';

const client = new VoyageAIClient();

async function generateEmbedding(text, model = 'voyage-3-large', inputType = 'query') {
    const response = await client.embed({ input: text, model, inputType });
    return response.data[0].embedding;
}
```

- The field is `inputType` (camelCase), not `input_type`.
- `input` accepts a single string directly — no need to wrap it in a one-element array the way
  the Python example does.
- The response isn't a flat `.embeddings` array. It's `{ data: [{ embedding, index, object }],
model, usage }` — the actual vector is `response.data[0].embedding`.

## `inputType`: `query` vs `document`

Use `'query'` when embedding what the user asked, and `'document'` when embedding the chunks
of source text being indexed ahead of time. VoyageAI's models weight query and document
embeddings slightly differently under the hood to make the eventual similarity search more
accurate — using the wrong one for a given text is a subtle way to degrade search quality
without getting an error.

## What comes next

Generating an embedding for a single chunk or question doesn't answer anything by itself — the
real work is **comparing embeddings** (e.g. cosine similarity) to find which chunk's vector is
closest to the question's vector. That comparison step is what actually implements the
"search" in semantic search.
