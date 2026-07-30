// Combines 10f's tool-use conversation loop with 04b's streaming: instead of
// client.messages.create() returning one finished Message, client.messages.stream()
// lets us watch the tool call's arguments arrive incrementally. This is *basic* tool
// streaming — the API still buffers each top-level key of the tool input until it's
// complete and schema-valid before sending it, so text arrives token by token but the
// tool's JSON arrives in delay-then-burst chunks (see notes for why, and for
// fine-grained tool calling, which is NOT implemented here).

import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

const messages = [];

function addUserMessage(content) {
    messages.push({ role: 'user', content });
}

function addAssistantMessage(message) {
    messages.push({ role: 'assistant', content: message.content });
}

// Same shape as 10f's tool: a single-purpose function plus its schema. This one's
// input has a nested object (meta.word_count / meta.review) specifically so the
// "wait for a complete top-level key, then burst it out" buffering is visible per key.
function saveArticle() {
    return 'Article saved!';
}

const saveArticleSchema = {
    name: 'save_article',
    description: 'Saves a scholarly journal article',
    input_schema: {
        type: 'object',
        properties: {
            abstract: {
                type: 'string',
                description: 'Abstract of the article. One short sentence max',
            },
            meta: {
                type: 'object',
                properties: {
                    word_count: {
                        type: 'integer',
                        description: 'Word count',
                    },
                    review: {
                        type: 'string',
                        description: 'Eight sentence review of the paper',
                    },
                },
                required: ['word_count', 'review'],
            },
        },
        required: ['abstract', 'meta'],
    },
};

const TOOLS = [saveArticleSchema];

const TOOL_FUNCTIONS = {
    save_article: saveArticle,
};

// Same as 10f's runSingleTool/runTools, collapsed to one function since there's only
// ever one tool here.
function runTools(toolUseBlocks) {
    return toolUseBlocks.map((toolUseBlock) => {
        const fn = TOOL_FUNCTIONS[toolUseBlock.name];
        let content;
        let isError = false;

        try {
            content = fn(toolUseBlock.input);
        } catch (error) {
            content = error.message;
            isError = true;
        }

        return {
            type: 'tool_result',
            tool_use_id: toolUseBlock.id,
            content,
            is_error: isError,
        };
    });
}

// Runs one streamed turn, printing events as they arrive, then resolves to the
// completed Message (same shape client.messages.create() would have returned).
async function chatStream() {
    const stream = client.messages.stream({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1000,
        messages,
        tools: TOOLS,
    });

    // Text still streams token by token — nothing changes here from 04b.
    stream.on('text', (textDelta) => {
        process.stdout.write(textDelta);
    });

    // 'inputJson' is the SDK's equivalent of the lesson's InputJsonEvent: partialJson
    // is the chunk just received, jsonSnapshot is the cumulative object built so far.
    // Printing partialJson is what reveals the buffering — it prints in bursts, one
    // per completed top-level key, not steadily like the text above.
    stream.on('inputJson', (partialJson) => {
        process.stdout.write(partialJson);
    });

    // No high-level event fires when a tool_use block starts, so we read the raw
    // stream event for it — this is the one moment we drop to that level.
    stream.on('streamEvent', (event) => {
        if (event.type === 'content_block_start' && event.content_block.type === 'tool_use') {
            process.stdout.write(`\n>>> Tool call: "${event.content_block.name}"\n`);
        }
        if (event.type === 'content_block_stop') {
            process.stdout.write('\n');
        }
    });

    return stream.finalMessage();
}

// Same run_conversation shape as 10f: keep streaming turns and running whatever
// tools Claude asks for until it stops asking for one.
async function runConversation() {
    while (true) {
        const response = await chatStream();
        addAssistantMessage(response);

        if (response.stop_reason !== 'tool_use') {
            return;
        }

        const toolUseBlocks = response.content.filter((block) => block.type === 'tool_use');
        const toolResults = runTools(toolUseBlocks);
        addUserMessage(toolResults);
    }
}

addUserMessage('Create and save a fake computer science article.');

await runConversation();
