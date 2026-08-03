// The Files API and code execution are two separate features that are most useful together:
// the code execution container has no network access, so the Files API's upload/download
// endpoints are how data gets in and out. This mirrors the Python lesson's
// `upload(...)` + `container_upload` + `code_execution` combination, minus the notebook's
// helper functions — the SDK covers uploads/downloads directly.
//
// Files API uploads/downloads are still beta (`files-api-2025-04-14`), so those two calls go
// through `client.beta.files`. Code execution itself is GA on this SDK version, so the
// analysis request itself uses the regular (non-beta) `client.messages.create`.

import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const client = new Anthropic();

const MODEL = 'claude-opus-4-8';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CSV_PATH = path.join(__dirname, 'streaming.csv');
const OUTPUT_DIR = path.join(__dirname, 'output');

// 1. Upload the data file once. The returned file ID is what we reference in the message
// instead of inlining the CSV's bytes — the same file ID could be reused across many requests.
const fileMetadata = await client.beta.files.upload({
    file: fs.createReadStream(CSV_PATH),
    betas: ['files-api-2025-04-14'],
});

// 2. `container_upload` places that file inside the code execution container's input
// directory, alongside the text instructions asking Claude to analyze it.
const messages = [
    {
        role: 'user',
        content: [
            {
                type: 'text',
                text:
                    'Run a detailed analysis to determine the major drivers of churn in this streaming ' +
                    "service's user data. Your final output should include at least one detailed plot " +
                    'summarizing your findings.',
            },
            { type: 'container_upload', file_id: fileMetadata.id },
        ],
    },
];

const response = await client.messages.create({
    model: MODEL,
    max_tokens: 16000,
    messages,
    tools: [{ type: 'code_execution_20260521', name: 'code_execution' }],
});

// 3. The response interleaves several block types: Claude's running commentary (text), and
// pairs of (server_tool_use, *_tool_result) for each command it runs. The code_execution
// tool exposes two sub-tools under the hood — a shell (`bash_code_execution`) and a file
// editor (`text_editor_code_execution`) — rather than a single generic "code_execution" call,
// so those are the names/result types that actually show up here. Claude may go through
// several execute-observe cycles before its final answer, so all of these can repeat.
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

for (const block of response.content) {
    switch (block.type) {
        case 'text':
            console.log(`\n${block.text}`);
            break;

        case 'server_tool_use':
            if (block.name === 'bash_code_execution') {
                console.log(`\n[running] ${block.input.command}`);
            } else if (block.name === 'text_editor_code_execution') {
                console.log(`\n[editing file] ${block.input.command} ${block.input.path}`);
            }
            break;

        case 'bash_code_execution_tool_result': {
            const result = block.content;
            if (result.type === 'bash_code_execution_tool_result_error') {
                console.log(`[execution error: ${result.error_code}]`);
                break;
            }

            if (result.stdout) console.log(`[stdout]\n${result.stdout}`);
            if (result.stderr) console.log(`[stderr]\n${result.stderr}`);

            // Generated files (like the plot we asked for) come back as file IDs, not raw
            // bytes — download each one through the same Files API used for the upload.
            for (const output of result.content ?? []) {
                const downloaded = await client.beta.files.download(output.file_id, {
                    betas: ['files-api-2025-04-14'],
                });
                const meta = await client.beta.files.retrieveMetadata(output.file_id, {
                    betas: ['files-api-2025-04-14'],
                });
                // Never trust a model-supplied filename directly — strip any directory
                // components so a crafted name can't write outside OUTPUT_DIR.
                const safeName = path.basename(meta.filename);
                const outputPath = path.join(OUTPUT_DIR, safeName);
                const bytes = Buffer.from(await downloaded.arrayBuffer());
                fs.writeFileSync(outputPath, bytes);
                console.log(`[saved generated file: ${outputPath}]`);
            }
            break;
        }
    }
}
