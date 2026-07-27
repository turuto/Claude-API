import { CopilotClient, approveAll } from '@github/copilot-sdk';

// The Copilot SDK talks to a locally installed, already-authenticated `copilot` CLI
// (no API key in .env) — one client per process, reused across every chat() call below.
const client = new CopilotClient();
let started = false;

async function ensureStarted() {
    if (!started) {
        await client.start();
        started = true;
    }
}

export function addUserMessage(messages, content) {
    messages.push({ role: 'user', content });
}

export function addAssistantMessage(messages, content) {
    messages.push({ role: 'assistant', content });
}

// Sends a message to Copilot and returns its reply as plain text.
//
// Copilot sessions have no equivalent of Anthropic's `stop_sequences` or assistant-turn
// prefill (there's no way to seed the start of Copilot's reply and have it continue from
// there), so the `\`\`\`json` prefill trick this codebase uses to get clean JSON back
// doesn't carry over directly. Instead, when the caller has added a prefill-style
// assistant message, that content is folded into the prompt as an explicit instruction to
// respond with nothing but the JSON itself. `temperature` also has no session-level
// equivalent in this SDK, so it's accepted for signature parity with the Anthropic version
// but has no effect here.
export async function chat(messages, { system } = {}) {
    await ensureStarted();

    const userTurns = messages.filter((message) => message.role === 'user').map((message) => message.content);
    const assistantPrefill = messages.find((message) => message.role === 'assistant')?.content;

    let prompt = userTurns.join('\n\n');
    if (assistantPrefill) {
        prompt += `\n\nRespond with ONLY the JSON itself, with no markdown code fences and no
commentary before or after it — do not include the literal text "${assistantPrefill}".`;
    }

    const session = await client.createSession({
        model: 'auto',
        // This is a plain text-generation task with no need for file/shell access — approving
        // everything is safe here since nothing in this codebase's prompts asks Copilot to use
        // a tool, so no permission prompt should ever actually fire.
        onPermissionRequest: approveAll,
        ...(system && { systemMessage: { content: system, mode: 'replace' } }),
    });

    try {
        const response = await session.sendAndWait({ prompt });
        const content = response?.data.content ?? '';
        return assistantPrefill ? stripCodeFence(content) : content;
    } finally {
        await session.disconnect();
    }
}

// Some prompts in this codebase show their own example output wrapped in a ```json fence
// (see partials/prompts.js), and Copilot tends to mimic that formatting in its own reply
// even when told not to. Rather than rely on instruction-following alone, this strips the
// first fenced block out if one is there, so a wrapped reply still parses as JSON.
function stripCodeFence(text) {
    const fenced = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
    return fenced ? fenced[1].trim() : text;
}

// index.js calls this once, right at the end of the run, so the CLI connection this
// module opened doesn't keep the process alive after the report is written.
export async function closeClient() {
    if (started) {
        await client.stop();
    }
}
