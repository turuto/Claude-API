# Introduction to RAG (Retrieval Augmented Generation)

RAG is a technique for working with documents too big to fit in a single prompt. Instead of
stuffing an entire document into the prompt, you break it into chunks ahead of time and, at
question time, only include the chunks that are actually relevant to what's being asked.

## The problem it solves

Say you have an 800-page financial document and want to ask Claude something like "What risk
factors does this company have?" You need to get the relevant information from that document
in front of Claude somehow — but there are real limits on how much text a prompt can hold.

## Option 1: stuff the whole document into the prompt

The naive approach — extract all the text and drop it straight into the prompt alongside the
question:

```
Answer the user's question about the financial document.

<user_question>
{user_question}
</user_question>

<financial_document>
{financial_document}
</financial_document>
```

This breaks down for a few reasons:

- There's a hard limit on prompt length — the document might simply be too long to fit
- Claude gets less effective as prompts get very long, even when they technically fit
- Larger prompts cost more to process (you're paying for every token, relevant or not)
- Larger prompts take longer to process

## Option 2: chunk the document, retrieve only what's relevant

RAG's approach: as a preprocessing step, break the document into smaller chunks. Then, when a
user asks a question, search those chunks for the ones most relevant to the question and
include only those in the prompt.

For example, "What risks does this company face?" would trigger a search over the chunks,
find the one covering the "Risk Factors" section, and include just that chunk — not the other
799 pages.

### Benefits

- Claude focuses only on the most relevant content instead of wading through everything
- Scales up to very large documents that could never fit in one prompt
- Works across multiple documents, not just one
- Smaller prompts cost less and run faster

### Challenges

- Requires a preprocessing step to actually chunk the documents
- Needs a search mechanism to find which chunks are "relevant" to a given question
- A retrieved chunk might not contain all the context Claude actually needs to answer well
- There are many ways to chunk text (fixed-size splits, structure-aware splits by
  headers/sections, etc.) and no single best approach — the right one depends on the
  documents and the use case

## When to reach for RAG

RAG means more moving parts and more upfront work than just stuffing everything into a
prompt — chunking strategy, a retrieval/search mechanism, and accepting that retrieved chunks
are an imperfect proxy for full context. It's worth that complexity when documents are very
large, when there are multiple documents to search across, or when cost/latency need to be
optimized. The trade being made is simplicity for scalability and efficiency: more work to set
up, but it makes otherwise-impossible-sized document collections usable.
