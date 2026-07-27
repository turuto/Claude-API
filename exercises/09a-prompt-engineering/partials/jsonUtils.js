import { chat } from './basicChat.js';

// Same fix as 08/08b's chatJson: sanitize stray backslashes before parsing, with a retry
// loop as backstop. This exercise makes three separate model calls that all expect JSON
// back (ideas, test cases, grading), so all three route through this helper.
function escapeStrayBackslashes(text) {
    return text.replace(/\\["\\/bfnrtu]|\\/g, (match) => (match.length === 2 ? match : '\\\\'));
}

export async function chatJson(messages, chatOptions, retries = 2) {
    for (let attempt = 1; ; attempt++) {
        const text = await chat(messages, chatOptions);
        try {
            return JSON.parse(escapeStrayBackslashes(text));
        } catch (err) {
            if (attempt > retries) throw err;
        }
    }
}
