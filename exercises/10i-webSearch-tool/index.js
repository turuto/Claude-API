// Web search is a *server-side* tool: unlike every client-side tool from 10a-10h, Claude
// doesn't hand us a tool_use block to execute and send back. Anthropic's own infrastructure
// runs the search(es) and folds the results straight into the same response — the schema
// below is the only thing we provide, and there's no tool loop to write.
//
// Requires web search to be enabled for the organization in the Anthropic Console
// (https://console.anthropic.com/settings/privacy) — if it's off, this call fails.

import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

// `_20260209` is the current web search tool version (dynamic filtering, no beta header
// needed) for claude-opus-4-8 and other current models — the lesson's `web_search_20250305`
// is the older basic variant kept around for pre-4.6-generation models.
const webSearchSchema = {
    type: 'web_search_20260209',
    name: 'web_search',
    max_uses: 5,
    allowed_domains: ['nih.gov'],
};

const messages = [
    {
        role: 'user',
        content: "What's the best exercise for gaining leg muscle? Search nih.gov for current research and cite it.",
    },
];

const response = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 4096,
    messages,
    tools: [webSearchSchema],
});

// Each content block plays a different role in the UI: plain text is the answer itself,
// server_tool_use reveals what Claude ran (a search query, or — on this tool version, which
// filters results through code execution under the hood — the filtering code itself),
// web_search_tool_result carries the raw hits, and any citations attached to a text block
// point back to the specific source that backs that sentence.
for (const block of response.content) {
    switch (block.type) {
        case 'server_tool_use':
            if (block.name === 'web_search') {
                console.log(`\n[searched for: "${block.input.query}"]`);
            } else {
                console.log(`\n[ran ${block.name}]`);
            }
            break;

        case 'web_search_tool_result':
            // A failed search comes back as a single error object, not an exception —
            // `content` is an array only on success.
            if (Array.isArray(block.content)) {
                console.log('[sources found]');
                for (const result of block.content) {
                    console.log(`  - ${result.title} (${result.url})`);
                }
            } else {
                console.log(`[search error: ${block.content.error_code}]`);
            }
            break;

        case 'text':
            console.log(`\n${block.text}`);
            for (const citation of block.citations ?? []) {
                console.log(`  [source: ${citation.title} — ${citation.url}]`);
            }
            break;
    }
}
