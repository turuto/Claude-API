// The complete RAG flow: chunk -> embed -> store -> embed the question -> search. 11a and 11b
// built the pieces in isolation; this wires them into a VectorIndex that Claude never talks
// to directly (still no Anthropic client here) — it's the retrieval half of RAG, done fully
// with VoyageAI embeddings and plain in-memory math. See rag-pipeline-walkthrough.md for the
// conceptual (toy 2D vector) version of this same flow, and vector-index-and-search.md for the
// five-step breakdown this file implements.

import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { VoyageAIClient } from 'voyageai';

const here = dirname(fileURLToPath(import.meta.url));
const voyageClient = new VoyageAIClient();

// Splits on the document's own `## ` section headers — see 11a-RAG-chunking for the other two
// chunking strategies and their trade-offs.
function chunkBySection(documentText) {
    return documentText.split(/\n## /);
}

// Upgraded from 11b's version to accept either a single string or an array of strings, so a
// whole document's worth of chunks can be embedded in one VoyageAI call instead of one at a
// time — the lesson notes this avoids rate-limiting errors when there are many chunks.
async function generateEmbedding(input, model = 'voyage-3-large', inputType = 'query') {
    const isList = Array.isArray(input);
    const texts = isList ? input : [input];

    const response = await voyageClient.embed({ input: texts, model, inputType });
    const embeddings = response.data.map((item) => item.embedding);

    return isList ? embeddings : embeddings[0];
}

// An in-memory vector store: holds embeddings alongside the document (the original chunk text)
// each one came from, and can search for the stored vectors closest to a query. Storing the
// original text matters — the embedding alone can find the right chunk, but only the text can
// actually go in a prompt.
class VectorIndex {
    constructor(distanceMetric = 'cosine', embeddingFn = null) {
        if (!['cosine', 'euclidean'].includes(distanceMetric)) {
            throw new Error("distanceMetric must be 'cosine' or 'euclidean'");
        }

        this.vectors = [];
        this.documents = [];
        this.vectorDim = null;
        this.distanceMetric = distanceMetric;
        this.embeddingFn = embeddingFn;
    }

    get size() {
        return this.vectors.length;
    }

    // Embeds one document's content and stores it. Requires `embeddingFn` — there's no vector
    // to store otherwise.
    async addDocument(document) {
        if (!this.embeddingFn) {
            throw new Error('Embedding function not provided during initialization.');
        }
        if (typeof document !== 'object' || document === null || !('content' in document)) {
            throw new Error("Document must be an object with a 'content' key.");
        }
        if (typeof document.content !== 'string') {
            throw new Error("Document 'content' must be a string.");
        }

        const vector = await this.embeddingFn(document.content);
        this.addVector(vector, document);
    }

    // Bulk version of addDocument: embeds every document's content in a single batched call
    // via `embeddingFn`, rather than one VoyageAI request per document.
    async addDocuments(documents) {
        if (!this.embeddingFn) {
            throw new Error('Embedding function not provided during initialization.');
        }

        const contents = documents.map((document) => {
            if (typeof document !== 'object' || document === null || typeof document.content !== 'string') {
                throw new Error("Each document must be an object with a string 'content' key.");
            }
            return document.content;
        });

        const vectors = await this.embeddingFn(contents);
        vectors.forEach((vector, i) => this.addVector(vector, documents[i]));
    }

    // Stores a precomputed vector directly, alongside whatever document it came from.
    addVector(vector, document) {
        if (!Array.isArray(vector) || !vector.every((x) => typeof x === 'number')) {
            throw new Error('Vector must be an array of numbers.');
        }
        if (typeof document !== 'object' || document === null || !('content' in document)) {
            throw new Error("Document must be an object with a 'content' key.");
        }

        if (this.vectors.length === 0) {
            this.vectorDim = vector.length;
        } else if (vector.length !== this.vectorDim) {
            throw new Error(`Inconsistent vector dimension. Expected ${this.vectorDim}, got ${vector.length}`);
        }

        this.vectors.push([...vector]);
        this.documents.push(document);
    }

    // Accepts either a query string (embedded via `embeddingFn`) or a precomputed vector, and
    // returns the `k` closest stored documents as [document, distance] pairs, nearest first.
    async search(query, k = 1) {
        if (this.vectors.length === 0) {
            return [];
        }

        let queryVector;
        if (typeof query === 'string') {
            if (!this.embeddingFn) {
                throw new Error('Embedding function not provided for string query.');
            }
            queryVector = await this.embeddingFn(query);
        } else if (Array.isArray(query) && query.every((x) => typeof x === 'number')) {
            queryVector = query;
        } else {
            throw new Error('Query must be either a string or an array of numbers.');
        }

        if (queryVector.length !== this.vectorDim) {
            throw new Error(`Query vector dimension mismatch. Expected ${this.vectorDim}, got ${queryVector.length}`);
        }
        if (k <= 0) {
            throw new Error('k must be a positive integer.');
        }

        const distances = this.vectors.map((storedVector, i) => {
            const distance =
                this.distanceMetric === 'cosine'
                    ? this._cosineDistance(queryVector, storedVector)
                    : this._euclideanDistance(queryVector, storedVector);
            return [distance, this.documents[i]];
        });

        distances.sort((a, b) => a[0] - b[0]);

        return distances.slice(0, k).map(([distance, document]) => [document, distance]);
    }

    _euclideanDistance(vec1, vec2) {
        return Math.sqrt(vec1.reduce((sum, v, i) => sum + (v - vec2[i]) ** 2, 0));
    }

    _dotProduct(vec1, vec2) {
        return vec1.reduce((sum, v, i) => sum + v * vec2[i], 0);
    }

    _magnitude(vec) {
        return Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
    }

    _cosineDistance(vec1, vec2) {
        const mag1 = this._magnitude(vec1);
        const mag2 = this._magnitude(vec2);

        if (mag1 === 0 && mag2 === 0) {
            return 0.0;
        }
        if (mag1 === 0 || mag2 === 0) {
            return 1.0;
        }

        const cosineSimilarity = Math.max(-1.0, Math.min(1.0, this._dotProduct(vec1, vec2) / (mag1 * mag2)));
        return 1.0 - cosineSimilarity;
    }
}

// 1. Chunk the text by section.
const reportText = readFileSync(join(here, 'report.md'), 'utf-8');
const chunks = chunkBySection(reportText);

// 2 & 3. Embed every chunk and store it, in one batched call via addDocuments — separate
// generateEmbedding + addVector calls would work too, but batching is what avoids hitting
// VoyageAI's rate limit once there are more than a handful of chunks.
const store = new VectorIndex('cosine', generateEmbedding);
await store.addDocuments(chunks.map((chunk) => ({ content: chunk })));

// 4. Some time later, a user asks a question — `store.search` embeds it for us since we gave
// the store an `embeddingFn`, so there's no separate generateEmbedding call needed here.
const userQuestion = 'What did the software engineering dept do last year?';

// 5. Search the store, find the 2 most relevant chunks.
const results = await store.search(userQuestion, 2);

for (const [document, distance] of results) {
    console.log(distance, '\n', document.content.slice(0, 200), '\n');
}
