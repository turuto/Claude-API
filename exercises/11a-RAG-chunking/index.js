// Chunking is a preprocessing step, not an API call — nothing here talks to Claude, so unlike
// every exercise since 00-hello-claude there's no dotenv/Anthropic client to set up. The three
// functions below are the building blocks the rest of this RAG section builds on: 11b turns a
// chunk into an embedding, and 11c uses that embedding to actually search for the right one.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

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

const reportText = readFileSync(join(here, 'report.md'), 'utf-8');

function printChunks(label, chunks) {
    console.log(`\n=== ${label} (${chunks.length} chunks) ===\n`);
    chunks.forEach((chunk) => console.log(`${chunk}\n----`));
}

printChunks('chunkByChar', chunkByChar(reportText));
printChunks('chunkBySentence', chunkBySentence(reportText));
printChunks('chunkBySection', chunkBySection(reportText));
