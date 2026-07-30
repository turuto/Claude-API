// The text editor tool is one of Claude's built-in tools: unlike every tool in 10a-10g, we
// don't write its JSON schema or its description — Claude already knows the full spec for
// view/str_replace/create/insert. All we send is a small stub identifying which version to use,
// and all we have to write is the implementation that actually touches the filesystem (see
// text-editor-tool.js). The version string is tied to the model: current models (including this
// project's default, claude-opus-4-8) use `text_editor_20250728` + `str_replace_based_edit_tool`.

import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import { TextEditorTool } from './text-editor-tool.js';

const client = new Anthropic();

const textEditorTool = new TextEditorTool();

const TEXT_EDITOR_SCHEMA = {
    type: 'text_editor_20250728',
    name: 'str_replace_based_edit_tool',
};

// Maps each text editor command to the implementation call it needs, translating the wire
// format's snake_case fields into the class's own parameters.
function runTextEditorCommand(input) {
    switch (input.command) {
        case 'view':
            return textEditorTool.view(input.path, input.view_range);
        case 'str_replace':
            return textEditorTool.strReplace(input.path, input.old_str, input.new_str);
        case 'create':
            return textEditorTool.create(input.path, input.file_text);
        case 'insert':
            return textEditorTool.insert(input.path, input.insert_line, input.insert_text);
        default:
            throw new Error(`Unknown text editor command: ${input.command}`);
    }
}

function runSingleTool(toolUseBlock) {
    let content;
    let isError = false;

    try {
        content = String(runTextEditorCommand(toolUseBlock.input));
    } catch (error) {
        content = error.message;
        isError = true;
    }

    console.log(`  ran ${toolUseBlock.name}(${JSON.stringify(toolUseBlock.input)}) -> ${content}`);

    return {
        type: 'tool_result',
        tool_use_id: toolUseBlock.id,
        content,
        is_error: isError,
    };
}

function runTools(toolUseBlocks) {
    return toolUseBlocks.map(runSingleTool);
}

const messages = [];

function addUserMessage(message) {
    const content = typeof message === 'string' || Array.isArray(message) ? message : message.content;
    messages.push({ role: 'user', content });
}

function addAssistantMessage(message) {
    const content = typeof message === 'string' || Array.isArray(message) ? message : message.content;
    messages.push({ role: 'assistant', content });
}

async function chat() {
    const response = await client.messages.create({
        model: 'claude-opus-4-8',
        max_tokens: 4096,
        messages,
        tools: [TEXT_EDITOR_SCHEMA],
    });
    return response;
}

function textFromMessage(message) {
    return message.content
        .filter((block) => block.type === 'text')
        .map((block) => block.text)
        .join('\n');
}

async function runConversation(userInput) {
    addUserMessage(userInput);

    while (true) {
        const response = await chat();
        addAssistantMessage(response);

        const text = textFromMessage(response);
        if (text) {
            console.log(`Claude: ${text}`);
        }

        if (response.stop_reason !== 'tool_use') {
            return text;
        }

        const toolUseBlocks = response.content.filter((block) => block.type === 'tool_use');
        addUserMessage(runTools(toolUseBlocks));
    }
}

await runConversation(
    'Open the ./main.js file and write a function to calculate pi to the 5th decimal digit ' +
        '(using the Leibniz series is fine). Then create a ./test.js file with a couple of ' +
        'assertions that test your implementation. These files run under Node with ' +
        '"type": "module", so use ES module import/export syntax, not require()/module.exports.',
);
