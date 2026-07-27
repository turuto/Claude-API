import { chat } from './basicChat.js';

// Cleans up a formatting quirk that can otherwise break JSON parsing below.
function escapeStrayBackslashes(text) {
    return text.replace(/\\["\\/bfnrtu]|\\/g, (match) => (match.length === 2 ? match : '\\\\'));
}

// Asks Claude for a reply and parses it as JSON, trying again if the reply wasn't valid
// JSON. Used for the three behind-the-scenes steps that all expect a JSON answer back:
// coming up with test scenarios, building test cases, and grading outputs.
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
