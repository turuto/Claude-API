// The notebook's helper cell (add_user_message/add_assistant_message/chat/text_from_message)
// is identical to 12's — same course boilerplate, carried forward unchanged since this lesson
// doesn't add anything new to chat() itself. What's actually new is entirely inside the
// notebook's TODO cell ("read image data, feed into Claude"): build an image content block
// and send it alongside the fire-risk-assessment prompt. temperature stays dropped and
// thinking stays adaptive-only, per 12's notes on claude-opus-4-8 — neither is exercised here
// since this lesson never turns thinking on.

import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const client = new Anthropic();

const MODEL = 'claude-opus-4-8';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IMAGES_DIR = path.join(__dirname, 'images');

// Same growing-history array as 10e/10f/12: Claude is stateless, so every turn resends
// everything.
const messages = [];

// Same shape as 10e/10f/12: accepts a string, an array of content blocks (how the image +
// text block pair below gets in), or a full API response object.
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

// Same as 12's chat(): temperature dropped (rejected on this model), thinking is adaptive +
// effort instead of a fixed budget_tokens. Neither thinking nor tools gets used below.
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

// The lesson's fire-risk-assessment prompt: a structured, step-by-step methodology instead
// of a bare "rate the fire risk" — the vision lesson's point is that simple prompts get
// noticeably worse results on image-analysis tasks than a broken-down methodology does.
const prompt = `
Analyze the attached satellite image of a property with these specific steps:

1. Residence identification: Locate the primary residence on the property by looking for:
   - The largest roofed structure
   - Typical residential features (driveway connection, regular geometry)
   - Distinction from other structures (garages, sheds, pools)
   Describe the residence's location relative to property boundaries and other features.

2. Tree overhang analysis: Examine all trees near the primary residence:
   - Identify any trees whose canopy extends directly over any portion of the roof
   - Estimate the percentage of roof covered by overhanging branches (0-25%, 25-50%, 50-75%, 75-100%)
   - Note particularly dense areas of overhang

3. Fire risk assessment: For any overhanging trees, evaluate:
   - Potential wildfire vulnerability (ember catch points, continuous fuel paths to structure)
   - Proximity to chimneys, vents, or other roof openings if visible
   - Areas where branches create a "bridge" between wildland vegetation and the structure

4. Defensible space identification: Assess the property's overall vegetative structure:
   - Identify if trees connect to form a continuous canopy over or near the home
   - Note any obvious fuel ladders (vegetation that can carry fire from ground to tree to roof)

5. Fire risk rating: Based on your analysis, assign a Fire Risk Rating from 1-4:
   - Rating 1 (Low Risk): No tree branches overhanging the roof, good defensible space around the structure
   - Rating 2 (Moderate Risk): Minimal overhang (<25% of roof), some separation between tree canopies
   - Rating 3 (High Risk): Significant overhang (25-50% of roof), connected tree canopies, multiple points of vulnerability
   - Rating 4 (Severe Risk): Extensive overhang (>50% of roof), dense vegetation against structure, numerous ember catch points, limited defensible space

For each item above (1-5), write one sentence summarizing your findings, with your final response being the numeric Fire Risk Rating (1-4) with a brief justification.
`;

const MEDIA_TYPES = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
};

// The image isn't committed to this repo (see images/README.md) — this resolves whichever
// extension the user actually dropped in.
function findImageFile(baseName) {
    for (const ext of Object.keys(MEDIA_TYPES)) {
        const filePath = path.join(IMAGES_DIR, `${baseName}${ext}`);
        if (fs.existsSync(filePath)) return filePath;
    }
    throw new Error(`No image found for "${baseName}" in ${IMAGES_DIR} — see images/README.md for what to add.`);
}

// --- The notebook's TODO: read image data, feed into Claude -----------------------------
// Python's open(...).read() + base64.standard_b64encode(...).decode('utf-8') becomes
// fs.readFileSync(...).toString('base64') here — same bytes, same encoding. The image block
// and the text block sit side by side in one user message.

const imagePath = findImageFile('satellite');
const mediaType = MEDIA_TYPES[path.extname(imagePath).toLowerCase()];
const imageData = fs.readFileSync(imagePath).toString('base64');

addUserMessage([
    { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageData } },
    { type: 'text', text: prompt },
]);

const response = await chat();
addAssistantMessage(response);

console.log(textFromMessage(response));
