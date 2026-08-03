// PDF processing is nearly identical to 13's image processing — same base64-encoding step,
// same content-block-alongside-text-block message shape. The lesson's own diff from images
// is small: content block type "document" instead of "image", media_type "application/pdf"
// instead of "image/png", and file_bytes instead of image_bytes as the variable name (Claude
// can read the PDF's text, embedded images/charts, and table structure — not just render it).
// Helper functions are unchanged from 12/13's boilerplate.

import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const client = new Anthropic();

const MODEL = 'claude-opus-4-8';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PDF_PATH = path.join(__dirname, 'pdfs', 'earth.pdf');

const messages = [];

function addUserMessage(message) {
    let content;
    if (typeof message === 'string' || Array.isArray(message)) {
        content = message;
    } else {
        content = message.content;
    }
    messages.push({ role: 'user', content });
}

function addAssistantMessage(message) {
    let content;
    if (typeof message === 'string' || Array.isArray(message)) {
        content = message;
    } else {
        content = message.content;
    }
    messages.push({ role: 'assistant', content });
}

async function chat(tools, { system, stopSequences = [], thinking = false, effort } = {}) {
    const params = {
        model: MODEL,
        max_tokens: 4000,
        messages,
        stop_sequences: stopSequences,
    };

    if (thinking) {
        params.thinking = { type: 'adaptive', display: 'summarized' };
    }

    if (effort) {
        params.output_config = { effort };
    }

    if (tools) {
        params.tools = tools;
    }

    if (system) {
        params.system = system;
    }

    return client.messages.create(params);
}

function textFromMessage(message) {
    return message.content
        .filter((block) => block.type === 'text')
        .map((block) => block.text)
        .join('\n');
}

if (!fs.existsSync(PDF_PATH)) {
    throw new Error(`No PDF found at ${PDF_PATH} — see pdfs/README.md for what to add.`);
}

// Python's open(...).read() + base64.standard_b64encode(...).decode('utf-8') becomes
// fs.readFileSync(...).toString('base64') here, same as 13 — only the content block's
// `type` and `media_type` change for a document instead of an image.
const fileBytes = fs.readFileSync(PDF_PATH).toString('base64');

addUserMessage([
    { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: fileBytes } },
    { type: 'text', text: 'Summarize the document in one sentence' },
]);

const response = await chat();
addAssistantMessage(response);

console.log(textFromMessage(response));
