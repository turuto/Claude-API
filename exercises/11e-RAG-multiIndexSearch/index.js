// Hybrid search: run semantic search (VectorIndex, 11c) and lexical search (BM25Index, 11d) in
// parallel against the same chunks, then merge the two result lists into one ranking. Neither
// index needs to change how it scores internally — the Retriever below only needs each index to
// expose the same three-method shape (add_document, add_documents, search), then it merges by
// *rank*, not by score, which sidesteps ever having to compare a cosine distance to a BM25
// score directly. See multi-index-retrieval.md for why that matters.

import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { VoyageAIClient } from 'voyageai';

const here = dirname(fileURLToPath(import.meta.url));
const voyageClient = new VoyageAIClient();

// Splits on the document's own `## ` section headers — same as every exercise in this section.
function chunkBySection(documentText) {
    return documentText.split(/\n## /);
}

// Accepts a single string or an array of strings, embedding all of them in one VoyageAI call
// when given an array — see 11c for why batching matters (rate limits).
async function generateEmbedding(input, model = 'voyage-3-large', inputType = 'query') {
    const isList = Array.isArray(input);
    const texts = isList ? input : [input];

    const response = await voyageClient.embed({ input: texts, model, inputType });
    const embeddings = response.data.map((item) => item.embedding);

    return isList ? embeddings : embeddings[0];
}

// Same VectorIndex as 11c, with one refinement now that 005_hybrid.ipynb shows the lesson's own
// `add_documents` implementation: it validates every document up front (dict, has 'content',
// content is a string) before embedding any of them, and no-ops on an empty list, instead of
// the looser version 11c had to write from scratch (that notebook never showed the method body).
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

    async addDocuments(documents) {
        if (!this.embeddingFn) {
            throw new Error('Embedding function not provided during initialization.');
        }
        if (!Array.isArray(documents)) {
            throw new Error('Documents must be an array of objects.');
        }
        if (documents.length === 0) {
            return;
        }

        const contents = documents.map((document, i) => {
            if (typeof document !== 'object' || document === null || !('content' in document)) {
                throw new Error(`Document at index ${i} must be an object with a 'content' key.`);
            }
            if (typeof document.content !== 'string') {
                throw new Error(`Document 'content' at index ${i} must be a string.`);
            }
            return document.content;
        });

        const vectors = await this.embeddingFn(contents);
        vectors.forEach((vector, i) => this.addVector(vector, documents[i]));
    }

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

// Same BM25Index as 11d, plus an `addDocuments` method — BM25 has no external API to batch
// against, so this is really just addDocument's per-item logic run in a loop. It exists purely
// so BM25Index has the same three-method shape as VectorIndex, which is all Retriever requires.
class BM25Index {
    constructor(k1 = 1.5, b = 0.75, tokenizer = null) {
        this.documents = [];
        this.k1 = k1;
        this.b = b;
        this.tokenizer = tokenizer || this._defaultTokenizer;

        this._corpusTokens = [];
        this._docLen = [];
        this._docFreqs = {};
        this._avgDocLen = 0;
        this._idf = {};
        this._indexBuilt = false;
    }

    get size() {
        return this.documents.length;
    }

    _defaultTokenizer(text) {
        return text.toLowerCase().split(/\W+/).filter(Boolean);
    }

    _updateStatsAdd(docTokens) {
        this._docLen.push(docTokens.length);

        const seenInDoc = new Set();
        for (const token of docTokens) {
            if (!seenInDoc.has(token)) {
                this._docFreqs[token] = (this._docFreqs[token] || 0) + 1;
                seenInDoc.add(token);
            }
        }

        this._indexBuilt = false;
    }

    _calculateIdf() {
        const N = this.documents.length;
        this._idf = {};
        for (const [term, freq] of Object.entries(this._docFreqs)) {
            this._idf[term] = Math.log((N - freq + 0.5) / (freq + 0.5) + 1);
        }
    }

    _buildIndex() {
        if (this.documents.length === 0) {
            this._avgDocLen = 0;
            this._idf = {};
            this._indexBuilt = true;
            return;
        }

        this._avgDocLen = this._docLen.reduce((sum, len) => sum + len, 0) / this.documents.length;
        this._calculateIdf();
        this._indexBuilt = true;
    }

    addDocument(document) {
        if (typeof document !== 'object' || document === null || !('content' in document)) {
            throw new Error("Document must be an object with a 'content' key.");
        }
        if (typeof document.content !== 'string') {
            throw new Error("Document 'content' must be a string.");
        }

        const docTokens = this.tokenizer(document.content);

        this.documents.push(document);
        this._corpusTokens.push(docTokens);
        this._updateStatsAdd(docTokens);
    }

    addDocuments(documents) {
        if (!Array.isArray(documents)) {
            throw new Error('Documents must be an array of objects.');
        }
        if (documents.length === 0) {
            return;
        }

        documents.forEach((document, i) => {
            if (typeof document !== 'object' || document === null || !('content' in document)) {
                throw new Error(`Document at index ${i} must be an object with a 'content' key.`);
            }
            if (typeof document.content !== 'string') {
                throw new Error(`Document 'content' at index ${i} must be a string.`);
            }

            const docTokens = this.tokenizer(document.content);
            this.documents.push(document);
            this._corpusTokens.push(docTokens);
            this._updateStatsAdd(docTokens);
        });

        this._indexBuilt = false;
    }

    _computeBM25Score(queryTokens, docIndex) {
        let score = 0;
        const docTermCounts = {};
        for (const token of this._corpusTokens[docIndex]) {
            docTermCounts[token] = (docTermCounts[token] || 0) + 1;
        }
        const docLength = this._docLen[docIndex];

        for (const token of queryTokens) {
            if (!(token in this._idf)) {
                continue;
            }

            const idf = this._idf[token];
            const termFreq = docTermCounts[token] || 0;

            const numerator = idf * termFreq * (this.k1 + 1);
            const denominator = termFreq + this.k1 * (1 - this.b + this.b * (docLength / this._avgDocLen));
            score += numerator / (denominator + 1e-9);
        }

        return score;
    }

    search(queryText, k = 1, scoreNormalizationFactor = 0.1) {
        if (this.documents.length === 0) {
            return [];
        }
        if (typeof queryText !== 'string') {
            throw new Error('Query must be a string for BM25Index.');
        }
        if (k <= 0) {
            throw new Error('k must be a positive integer.');
        }

        if (!this._indexBuilt) {
            this._buildIndex();
        }
        if (this._avgDocLen === 0) {
            return [];
        }

        const queryTokens = this.tokenizer(queryText);
        if (queryTokens.length === 0) {
            return [];
        }

        const rawScores = [];
        for (let i = 0; i < this.documents.length; i++) {
            const rawScore = this._computeBM25Score(queryTokens, i);
            if (rawScore > 1e-9) {
                rawScores.push([rawScore, this.documents[i]]);
            }
        }
        rawScores.sort((a, b) => b[0] - a[0]);

        const normalized = rawScores
            .slice(0, k)
            .map(([rawScore, document]) => [document, Math.exp(-scoreNormalizationFactor * rawScore)]);
        normalized.sort((a, b) => a[1] - b[1]);

        return normalized;
    }
}

// Fans a document (or batch of documents) out to every underlying index, then merges each
// index's own search results with Reciprocal Rank Fusion (RRF) — see multi-index-retrieval.md
// for what RRF is and why it only needs each index's *ranking*, never its raw scores.
class Retriever {
    constructor(...indexes) {
        if (indexes.length === 0) {
            throw new Error('At least one index must be provided');
        }
        this.indexes = indexes;
    }

    async addDocument(document) {
        for (const index of this.indexes) {
            await index.addDocument(document);
        }
    }

    async addDocuments(documents) {
        for (const index of this.indexes) {
            await index.addDocuments(documents);
        }
    }

    async search(queryText, k = 1, kRrf = 60) {
        if (typeof queryText !== 'string') {
            throw new Error('Query text must be a string.');
        }
        if (k <= 0) {
            throw new Error('k must be a positive integer.');
        }
        if (kRrf < 0) {
            throw new Error('kRrf must be non-negative.');
        }

        // Over-fetch (k * 5) from each index so there's a real pool of candidates to fuse —
        // the document that wins overall might only be, say, 4th place in one index's list.
        const allResults = await Promise.all(this.indexes.map((index) => index.search(queryText, k * 5)));

        // Track each document's rank (1-based position) within every index's result list.
        // A document absent from an index's results gets Infinity, which contributes 0 to its
        // RRF score below rather than crashing the sum.
        const docRanks = new Map();
        allResults.forEach((results, indexPosition) => {
            results.forEach(([document], rank) => {
                if (!docRanks.has(document)) {
                    docRanks.set(document, { document, ranks: new Array(this.indexes.length).fill(Infinity) });
                }
                docRanks.get(document).ranks[indexPosition] = rank + 1;
            });
        });

        const calcRrfScore = (ranks) =>
            ranks.reduce((sum, rank) => (rank === Infinity ? sum : sum + 1 / (kRrf + rank)), 0);

        const scoredDocs = [...docRanks.values()].map(({ document, ranks }) => [document, calcRrfScore(ranks)]);

        return scoredDocs
            .filter(([, score]) => score > 0)
            .sort((a, b) => b[1] - a[1])
            .slice(0, k);
    }
}

// Chunk the source text by section.
const reportText = readFileSync(join(here, 'report.md'), 'utf-8');
const chunks = chunkBySection(reportText);

// Create a vector index, a BM25 index, then combine them into one Retriever.
const vectorIndex = new VectorIndex('cosine', generateEmbedding);
const bm25Index = new BM25Index();
const retriever = new Retriever(bm25Index, vectorIndex);

// Add all chunks to the retriever, which fans them out to both indexes — batched so the vector
// index's half of this only costs one VoyageAI call.
await retriever.addDocuments(chunks.map((chunk) => ({ content: chunk })));

// Search across both indexes at once and merge via RRF.
const results = await retriever.search('What happened with INC-2023-Q4-011?', 3);

for (const [document, score] of results) {
    console.log(score, '\n', document.content.slice(0, 200), '\n----\n');
}
