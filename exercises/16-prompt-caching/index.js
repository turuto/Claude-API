// Prompt caching lets Claude reuse the preprocessing work (tokenizing, embedding, context
// analysis) it already did on a previous request instead of redoing it from scratch — as long
// as the content up to a "cache breakpoint" is byte-for-byte identical to a request made within
// the last hour. It's opt-in per block: you attach `cache_control: { type: 'ephemeral' }` to a
// system block, a tool, or a message content block. That's why system prompts below use the
// longhand array-of-blocks form instead of a plain string — the shorthand has no field to hang
// cache_control off of. See prompt-caching.md for the full write-up (1024-token minimum, 1hr
// TTL, wire order, the 4-breakpoint limit, exact-match invalidation).

import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

const MODEL = 'claude-opus-4-8';

// Long enough on its own to clear the 1024-token minimum for caching — a short prompt like
// "Hi there!" is never eligible, cache_control or not, until it's repeated to that length.
const CODE_REVIEW_SYSTEM_PROMPT = `
You are a senior JavaScript code reviewer with fifteen years of experience shipping production
systems at scale. Engineering teams bring you pull requests when they want a second, more
demanding pair of eyes than their usual reviewers provide. Your reviews are detailed, specific,
and grounded in concrete reasoning rather than vague style preferences — every point you raise
should explain the failure mode it prevents, not just assert a rule.

When reviewing naming, judge identifiers against these standards. A name should describe what a
value IS or DOES, not how it is currently implemented — "userList" is worse than "users" because
the former leaks a representation detail that will become false the day someone swaps the array
for a Set or Map. Boolean variables and functions should read as a yes/no question ("isReady",
"hasPermission", "canRetry") so call sites read like plain English. Functions that perform an
action should start with a verb ("fetchUser", "normalizePath", "debounce"), and functions that
compute a value without side effects should read like a noun phrase or getter ("userCount",
"nextAvailableSlot"). Avoid abbreviations that save fewer than four characters — "cfg" instead of
"config" saves nothing but comprehension. Flag any name that requires the reader to open the
function body to understand what it returns.

When reviewing function design, look for functions that do more than one thing at more than one
level of abstraction — a function that validates input, transforms it, and also handles logging
and retries is three functions wearing a trench coat. Prefer functions with fewer than four
parameters; beyond that, recommend an options object so call sites remain readable without
needing to count positional arguments against a signature. Watch for functions that mutate
arguments passed to them without documenting it — silent mutation is one of the most common
sources of action-at-a-distance bugs, especially once a codebase grows past a few thousand lines
and callers stop reading every callee's source before trusting it.

When reviewing control flow, flag deeply nested conditionals (more than two or three levels) and
suggest early returns or guard clauses instead. Prefer explicit handling of edge cases at the top
of a function over burying them in the middle of a happy-path block. Watch for loops that could
be expressed more clearly with array methods like map, filter, and reduce, but don't recommend
replacing a loop with a chain of five array methods if that chain is harder to read than the
loop it replaces — clarity is the goal, not idiom points. Be skeptical of clever one-liners: a
dense boolean expression that saves three lines but costs the reader thirty seconds of parsing is
a bad trade in most production code, though acceptable in tight, well-tested utility functions
that rarely change.

When reviewing error handling, check whether errors are caught at a level where the code has
enough context to do something useful with them — logging and rethrowing at every level of a call
stack is noise, not resilience. Distinguish between errors that represent bugs (which should
usually crash loudly in development and get reported in production) and errors that represent
expected failure modes (a network timeout, a missing file, a validation failure) which should be
handled explicitly and never silently swallowed. Flag any catch block that only logs and
continues without the caller being able to tell that anything went wrong — that's often worse
than not catching at all, because it converts a debuggable crash into a mysterious downstream
symptom.

When reviewing asynchronous code, check for unhandled promise rejections, races between
concurrent writes to shared state, and unnecessary sequential awaiting of operations that could
run in parallel with Promise.all. Watch for the common mistake of using async/await inside
Array.prototype.forEach, which silently discards the returned promises and does not wait for
anything — a for...of loop or Promise.all with map is almost always what the author intended.

When reviewing tests, check that they exercise behavior rather than implementation — a test that
breaks every time an internal helper is renamed, even though the function's observable behavior
hasn't changed, is testing the wrong thing. Look for missing edge cases: empty arrays, null and
undefined inputs, boundary values, and error paths, not just the happy path the author had in
mind while writing the code.

Keep your tone direct but constructive. Every piece of feedback should be actionable — the
engineer reading your review should know exactly what to change and why it matters, not just
that you disliked it. When code is genuinely fine as written, say so plainly rather than
inventing nitpicks to seem thorough; a review with ten manufactured minor comments is less useful
than one with two comments that actually matter.
`.trim();

// Five tool schemas for a smart-home assistant, with descriptions verbose enough that the
// whole array clears the 1024-token minimum on its own, independent of the system prompt above.
const SMART_HOME_TOOLS = [
    {
        name: 'get_weather_forecast',
        description:
            'Retrieves the current conditions and a multi-day forecast for a given location. Use this ' +
            'whenever the user asks about temperature, precipitation, wind, or general weather outlook, ' +
            'including indirect questions like whether they should bring an umbrella or water the garden. ' +
            'Returns hourly data for the current day and daily summaries for up to seven days out, along ' +
            'with any active severe weather alerts for the area.',
        input_schema: {
            type: 'object',
            properties: {
                location: { type: 'string', description: 'City and state/country, e.g. "Austin, TX".' },
                days: { type: 'integer', description: 'Number of forecast days to return, from 1 to 7.' },
            },
            required: ['location'],
        },
    },
    {
        name: 'set_thermostat',
        description:
            'Adjusts the target temperature and mode of a thermostat in a specific room or for the whole ' +
            'house. Use this when the user expresses a comfort preference, like being too warm or too cold, ' +
            'or explicitly asks to change the temperature. If the user only names a room, apply the change ' +
            'only there; if no room is given, apply it to the whole-house thermostat. Always confirm the ' +
            'resulting setpoint back to the user in their preferred unit (Fahrenheit or Celsius).',
        input_schema: {
            type: 'object',
            properties: {
                room: { type: 'string', description: 'Room name, or "whole_house" if unspecified.' },
                target_temperature: { type: 'number', description: 'Desired setpoint temperature.' },
                unit: { type: 'string', enum: ['fahrenheit', 'celsius'] },
                mode: { type: 'string', enum: ['heat', 'cool', 'auto', 'off'] },
            },
            required: ['room', 'target_temperature', 'unit'],
        },
    },
    {
        name: 'control_lights',
        description:
            'Turns lights on or off, or adjusts their brightness and color, for one room or a named group ' +
            'of lights. Use this for any request about lighting, including ambience requests like "make it ' +
            'cozy in here" (interpret as warm color temperature, lower brightness) or "movie mode" ' +
            '(interpret as dim, cool-toned light). If the user names a color by mood rather than a hex ' +
            'value, pick a reasonable RGB approximation yourself rather than asking a follow-up question.',
        input_schema: {
            type: 'object',
            properties: {
                room: { type: 'string', description: 'Room or light group name.' },
                on: { type: 'boolean', description: 'Whether the lights should be on.' },
                brightness: { type: 'integer', description: 'Brightness from 0 to 100.' },
                color: { type: 'string', description: 'Hex color code, e.g. "#FFAA33".' },
            },
            required: ['room', 'on'],
        },
    },
    {
        name: 'play_music',
        description:
            'Starts, stops, or changes music playback on a smart speaker in a given room, or across every ' +
            'connected speaker in the house if no room is specified. Use this for requests naming a song, ' +
            'artist, genre, playlist, or mood ("something upbeat for cooking"), as well as plain playback ' +
            'controls like pause, resume, skip, or volume changes. When a mood or activity is given instead ' +
            'of a specific track, translate it into a genre or playlist query yourself.',
        input_schema: {
            type: 'object',
            properties: {
                room: { type: 'string', description: 'Room or speaker group, or "everywhere".' },
                action: { type: 'string', enum: ['play', 'pause', 'resume', 'skip', 'set_volume'] },
                query: { type: 'string', description: 'Song, artist, genre, playlist, or mood.' },
                volume: { type: 'integer', description: 'Volume level from 0 to 100, for set_volume.' },
            },
            required: ['room', 'action'],
        },
    },
    {
        name: 'add_calendar_event',
        description:
            'Creates a new event on the household shared calendar. Use this whenever the user asks to be ' +
            'reminded of something, schedule an appointment, or block off time, even if they phrase it ' +
            'casually ("remind me to take the trash out Tuesday night"). Infer a sensible duration when ' +
            'none is given (30 minutes for reminders, 1 hour for appointments), and resolve relative dates ' +
            'like "tomorrow" or "next Tuesday" against the current date before calling this tool.',
        input_schema: {
            type: 'object',
            properties: {
                title: { type: 'string' },
                start_time: { type: 'string', description: 'ISO 8601 date-time.' },
                duration_minutes: { type: 'integer' },
                notes: { type: 'string' },
            },
            required: ['title', 'start_time'],
        },
    },
];

// A fictitious utils file, long enough on its own to clear the caching minimum, used as the
// "codebase" for demo 4's growing code-review conversation.
const CODE_TO_REVIEW = `
// src/utils/requestQueue.js

let queue = [];
let activeCount = 0;
const MAX_CONCURRENT = 4;

export function enqueue(task, priority) {
    queue.push({ task: task, priority: priority, addedAt: new Date() });
    queue.sort(function (a, b) {
        return b.priority - a.priority;
    });
    drain();
}

function drain() {
    while (activeCount < MAX_CONCURRENT && queue.length > 0) {
        var next = queue.shift();
        activeCount++;
        next.task()
            .then(function (result) {
                activeCount--;
                drain();
                return result;
            })
            .catch(function (err) {
                activeCount--;
                console.log('task failed: ' + err);
                drain();
            });
    }
}

export function getQueueLength() {
    return queue.length;
}

export function clearQueue() {
    queue = [];
}

export async function batchFetch(urls) {
    let results = [];
    for (let i = 0; i < urls.length; i++) {
        let res = await fetch(urls[i]);
        let data = await res.json();
        results.push(data);
    }
    return results;
}

export function retry(fn, attempts) {
    return new Promise((resolve, reject) => {
        function attempt(n) {
            fn()
                .then(resolve)
                .catch((err) => {
                    if (n <= 1) {
                        reject(err);
                    } else {
                        attempt(n - 1);
                    }
                });
        }
        attempt(attempts);
    });
}

export function debounce(fn, wait) {
    let timeout;
    return function () {
        let args = arguments;
        let context = this;
        clearTimeout(timeout);
        timeout = setTimeout(function () {
            fn.apply(context, args);
        }, wait);
    };
}

export function throttle(fn, limit) {
    let inThrottle;
    return function () {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            fn.apply(context, args);
            inThrottle = true;
            setTimeout(() => (inThrottle = false), limit);
        }
    };
}

export function chunkArray(arr, size) {
    let chunks = [];
    for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
    return chunks;
}

export function deepMerge(target, source) {
    for (let key in source) {
        if (typeof source[key] === 'object' && source[key] !== null) {
            if (!target[key]) target[key] = {};
            deepMerge(target[key], source[key]);
        } else {
            target[key] = source[key];
        }
    }
    return target;
}
`.trim();

function textFromMessage(message) {
    return message.content
        .filter((block) => block.type === 'text')
        .map((block) => block.text)
        .join('\n');
}

// Wraps a system prompt string in the longhand block form and attaches a cache breakpoint —
// this is what actually makes it cacheable, since the plain-string shorthand has no field to
// hang cache_control off of.
function cachedSystem(text) {
    return [{ type: 'text', text, cache_control: { type: 'ephemeral' } }];
}

// Mirrors the lesson's tools_clone approach: copy the array and the last tool before adding
// cache_control, rather than mutating the caller's original tools array in place.
function cachedTools(tools) {
    const cloned = tools.map((tool) => ({ ...tool }));
    cloned[cloned.length - 1] = { ...cloned[cloned.length - 1], cache_control: { type: 'ephemeral' } };
    return cloned;
}

async function chat(messages, { system, tools } = {}) {
    const params = { model: MODEL, max_tokens: 1024, messages };
    if (system) {
        params.system = system;
    }
    if (tools) {
        params.tools = tools;
    }
    return client.messages.create(params);
}

function logUsage(label, usage) {
    console.log(
        `${label}\n` +
            `  input_tokens=${usage.input_tokens}  ` +
            `cache_creation_input_tokens=${usage.cache_creation_input_tokens ?? 0}  ` +
            `cache_read_input_tokens=${usage.cache_read_input_tokens ?? 0}`,
    );
}

// --- Demo 1: caching a large system prompt -------------------------------------------------
// Identical request sent twice. The first pays to write the system prompt into the cache
// (cache_creation_input_tokens); the second reads it back for free instead of reprocessing it
// (cache_read_input_tokens), since every byte up to and including the breakpoint is unchanged.

console.log('=== Demo 1: caching a system prompt ===\n');

const reviewQuestion = [{ role: 'user', content: 'Is `getUserDataFromDB` a good function name? Why or why not?' }];

const sys1 = await chat(reviewQuestion, { system: cachedSystem(CODE_REVIEW_SYSTEM_PROMPT) });
logUsage('Request 1 (cold — writes the system prompt to cache)', sys1.usage);

const sys2 = await chat(reviewQuestion, { system: cachedSystem(CODE_REVIEW_SYSTEM_PROMPT) });
logUsage('Request 2 (identical — reads the system prompt from cache)', sys2.usage);

// --- Demo 2: caching tool schemas -----------------------------------------------------------
// The breakpoint sits on the last tool, so all five schemas are cached as one unit. The user
// message changes between requests, but that doesn't matter — only the tools need to match for
// the tools portion of the cache to hit.

console.log('\n=== Demo 2: caching tool schemas ===\n');

const tools = cachedTools(SMART_HOME_TOOLS);

const tools1 = await chat([{ role: 'user', content: "What's the weather like in Austin this week?" }], { tools });
logUsage('Request 1 (cold — writes the tool schemas to cache)', tools1.usage);

const tools2 = await chat([{ role: 'user', content: 'Turn the living room lights on and set them warm.' }], {
    tools,
});
logUsage('Request 2 (different message, same tools — tools cache still hits)', tools2.usage);

// --- Demo 3: changing cached content invalidates it ------------------------------------------
// Even a small addition to the system prompt makes it byte-for-byte different from what's
// cached, so this is a fresh write, not a read — there's no such thing as a partial match.

console.log('\n=== Demo 3: changing the cached content invalidates it ===\n');

const alteredPrompt = CODE_REVIEW_SYSTEM_PROMPT + ' Please be unusually thorough on this review.';
const sys3 = await chat(reviewQuestion, { system: cachedSystem(alteredPrompt) });
logUsage('Request with a modified system prompt (cache miss — writes again, does not read)', sys3.usage);

// --- Demo 4: cross-message caching in a growing conversation --------------------------------
// The breakpoint on turn 1 stays in place for every later request, so its cache read keeps
// hitting as the conversation grows. Each new turn also drops a fresh breakpoint on its own
// last block, extending the cached prefix to cover everything said so far — up to 4
// breakpoints are allowed per request, and this demo uses 3.

console.log('\n=== Demo 4: cross-message caching across a growing conversation ===\n');

let messages = [];

function addAssistantMessage(response) {
    messages.push({ role: 'assistant', content: response.content });
}

// Attaches a fresh cache breakpoint to the last block of this message, so everything up to
// and including it — the whole conversation so far — becomes eligible for a cache read on the
// next turn.
function addCachedUserMessage(content) {
    const blocks = typeof content === 'string' ? [{ type: 'text', text: content }] : content;
    blocks[blocks.length - 1] = { ...blocks[blocks.length - 1], cache_control: { type: 'ephemeral' } };
    messages.push({ role: 'user', content: blocks });
}

addCachedUserMessage([
    { type: 'text', text: `Here is a file I'm reviewing:\n\n${CODE_TO_REVIEW}` },
    { type: 'text', text: 'In two sentences, what does this file do?' },
]);
const turn1 = await chat(messages);
addAssistantMessage(turn1);
logUsage('Turn 1 (cold — writes the file + question to cache)', turn1.usage);
console.log(textFromMessage(turn1) + '\n');

addCachedUserMessage('Now list any bugs or race conditions you see in it.');
const turn2 = await chat(messages);
addAssistantMessage(turn2);
logUsage('Turn 2 (reads turn 1 from cache, writes this turn as the new prefix)', turn2.usage);
console.log(textFromMessage(turn2) + '\n');

addCachedUserMessage('Of those, which one would you fix first, and how?');
const turn3 = await chat(messages);
addAssistantMessage(turn3);
logUsage('Turn 3 (reads turns 1+2 from cache, writes this turn as the new prefix)', turn3.usage);
console.log(textFromMessage(turn3) + '\n');
