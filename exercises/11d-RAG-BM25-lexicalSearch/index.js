// Semantic search (11b/11c) finds conceptually related chunks via embeddings, but it can miss
// exact terms — an incident ID, an error code, a specific name — because embeddings capture
// meaning, not literal tokens. BM25 is the classic algorithm for *lexical* search: it scores
// documents by which query terms they actually contain, weighting rare terms (like an incident
// ID) far higher than common ones (like "a" or "the"). No embeddings, no API calls — this whole
// exercise is local, in-memory scoring.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

// Splits on the document's own `## ` section headers — same as 11a/11b/11c.
function chunkBySection(documentText) {
    return documentText.split(/\n## /);
}

// BM25 ("Best Match 25") scores a document against a query in four conceptual steps:
//   1. Tokenize the query into individual terms.
//   2. For each term, look at how many documents in the corpus contain it at all (document
//      frequency) — not how many times, just whether it shows up.
//   3. Weight each term by rarity (IDF — inverse document frequency): a term that appears in
//      almost every document contributes little to relevance; a term that appears in only one
//      or two documents is a strong signal.
//   4. Score each document by summing, over the query's terms, how often that term appears in
//      the document (term frequency) times the term's IDF weight — with two adjustments:
//      diminishing returns for repeated occurrences of the same term (`k1`), and normalizing
//      for document length so long documents don't win purely by containing more words (`b`).
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

    // Lowercase, then split on any run of non-word characters. Note this splits a hyphenated
    // ID like "INC-2023-Q4-011" into several tokens ("inc", "2023", "q4", "011") rather than
    // keeping it as one — BM25 still favors the right document, since those parts are
    // collectively still rare across an unrelated corpus, but it's worth knowing the tokenizer
    // isn't as literal as "one term per ID" might suggest.
    _defaultTokenizer(text) {
        return text.toLowerCase().split(/\W+/).filter(Boolean);
    }

    // Tracks document length and which documents each token appears in — `_docFreqs` counts
    // *documents containing the term at least once*, not raw occurrences, which is what IDF
    // needs.
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

    // Standard Okapi BM25 IDF: log(((N - freq + 0.5) / (freq + 0.5)) + 1). A term in nearly
    // every document (freq close to N) approaches log(1) = 0 — no signal. A term in only one or
    // two documents out of many gets a large positive weight.
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

    // The BM25 formula itself: for each query term present in this document, add
    // idf * termFreq * (k1 + 1) / (termFreq + k1 * (1 - b + b * docLength / avgDocLen)`.
    // `k1` caps how much repeating a term keeps adding to the score (diminishing returns); `b`
    // controls how much a document's length relative to the corpus average penalizes it.
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

    // Returns the `k` best-matching documents as [document, score] pairs. Raw BM25 scores are
    // "higher is more relevant", but this normalizes via `exp(-factor * rawScore)` so the
    // returned score is "lower is more relevant" instead — the same convention VectorIndex's
    // cosine distance uses, which matters once semantic and lexical results need to be merged
    // on a shared scale.
    search(queryText, k = 1, scoreNormalizationFactor = 0.1) {
        if (this.documents.length === 0) {
            return [];
        }
        if (typeof queryText !== 'string') {
            throw new Error('Query text must be a string.');
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

// 1. Chunk the text by section.
const reportText = readFileSync(join(here, 'report.md'), 'utf-8');
const chunks = chunkBySection(reportText);

// 2. Create a BM25 store and add each chunk to it.
const store = new BM25Index();
for (const chunk of chunks) {
    store.addDocument({ content: chunk });
}

// 3. Search the store for an exact, rare term — the kind of query semantic search alone can
// miss (see semantic-vs-lexical-search.md for the worked example).
const results = store.search('What happened with INC-2023-Q4-011?', 3);

for (const [document, score] of results) {
    console.log(score, '\n', document.content.slice(0, 200), '\n----\n');
}
