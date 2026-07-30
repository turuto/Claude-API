// The chunking functions are carried over from 11a unchanged — this exercise picks up where
// that one left off, turning a chunk of text into a text embedding. Generating an embedding
// isn't a Claude call at all: Anthropic doesn't offer an embeddings endpoint, so this uses
// VoyageAI, the provider the lesson recommends. That means a second API key — VOYAGE_API_KEY
// alongside ANTHROPIC_API_KEY in .env — read the same way `new Anthropic()` reads its own key:
// `new VoyageAIClient()` with no arguments picks it up from the environment automatically.

import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { VoyageAIClient } from 'voyageai';

const here = dirname(fileURLToPath(import.meta.url));
const voyageClient = new VoyageAIClient();

// Splits text into fixed-length windows. `chunkOverlap` repeats the tail of one chunk at the
// start of the next, so a sentence or word cut off at a chunk boundary still appears whole in
// at least one chunk.
function chunkByChar(text, chunkSize = 150, chunkOverlap = 20) {
    const chunks = [];
    let startIdx = 0;

    while (startIdx < text.length) {
        const endIdx = Math.min(startIdx + chunkSize, text.length);
        chunks.push(text.slice(startIdx, endIdx));

        startIdx = endIdx < text.length ? endIdx - chunkOverlap : text.length;
    }

    return chunks;
}

// Splits text into sentences first, then groups them into chunks of `maxSentencesPerChunk`,
// repeating `overlapSentences` sentences between consecutive chunks for the same reason
// chunkByChar overlaps characters — context that would otherwise be lost at the boundary.
function chunkBySentence(text, maxSentencesPerChunk = 5, overlapSentences = 1) {
    const sentences = text.split(/(?<=[.!?])\s+/);

    const chunks = [];
    let startIdx = 0;

    while (startIdx < sentences.length) {
        const endIdx = Math.min(startIdx + maxSentencesPerChunk, sentences.length);
        chunks.push(sentences.slice(startIdx, endIdx).join(' '));

        startIdx += maxSentencesPerChunk - overlapSentences;
        if (startIdx < 0) {
            startIdx = 0;
        }
    }

    return chunks;
}

// Splits on the document's own `## ` section headers. Cleanest, most meaningful chunks of the
// three — but only works because report.md is Markdown with a guaranteed heading structure.
function chunkBySection(documentText) {
    return documentText.split(/\n## /);
}

// `inputType` matters: use 'query' for the user's question, 'document' for chunks being
// indexed — VoyageAI's models weight the two differently to make the eventual similarity
// search more accurate. Note the shape difference from the lesson's Python: `input` takes the
// string directly (no need to wrap it in a one-element array), and the embedding comes back
// at `response.data[0].embedding`, not a flat `.embeddings` array.
async function generateEmbedding(text, model = 'voyage-3-large', inputType = 'query') {
    const response = await voyageClient.embed({ input: text, model, inputType });
    return response.data[0].embedding;
}

const reportText = readFileSync(join(here, 'report.md'), 'utf-8');
const chunks = chunkBySection(reportText);

const embedding = await generateEmbedding(chunks[0]);
console.log(`First section chunk (${chunks[0].length} chars):\n${chunks[0]}\n`);
console.log(`Embedding: ${embedding.length} dimensions`);
console.log(embedding);
