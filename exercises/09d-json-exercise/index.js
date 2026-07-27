import { addUserMessage, chat } from './partials/basicChat.js';
import { PromptEvaluator } from './partials/promptEvaluator.js';

// Increase maxConcurrentTasks for faster runs, but beware of rate limit errors.
const evaluator = new PromptEvaluator({ maxConcurrentTasks: 1 });

const dataset = await evaluator.generateDataset({
    taskDescription: 'Write a compact, concise 1 day meal plan for a single athlete',
    promptInputsSpec: {
        height: "Athlete's height in cm",
        weight: "Athlete's weight in kg",
        goal: 'Goal of the athlete',
        restrictions: 'Dietary restrictions of the athlete',
    },
    outputFile: new URL('output/dataset.json', import.meta.url),
    // Keep this low during iteration — raise it for a final, more confident validation pass.
    numCases: 3,
});

// Edit the prompt text below and re-run `npm run 09d` to see how the score changes.
function buildPrompt(promptInputs) {
    return `What should this person eat?

- Height: ${promptInputs.height}
- Weight: ${promptInputs.weight}
- Goal: ${promptInputs.goal}
- Dietary restrictions: ${promptInputs.restrictions}`;
}

async function runPrompt(promptInputs) {
    const messages = [];
    addUserMessage(messages, buildPrompt(promptInputs));
    return chat(messages);
}

// Placeholder values, not a real test case — just so the report can show the prompt
// template without needing an extra API call to fill it in with real data.
const promptText = buildPrompt({
    height: '{height}',
    weight: '{weight}',
    goal: '{goal}',
    restrictions: '{restrictions}',
});

await evaluator.runEvaluation({
    runPromptFunction: runPrompt,
    datasetFile: new URL('output/dataset.json', import.meta.url),
    extraCriteria: `The output should include:
- Daily caloric total
- Macronutrient breakdown
- Meals with exact foods, portions, and timing`,
    jsonOutputFile: new URL('output/output.json', import.meta.url),
    htmlOutputFile: new URL('output/output.html', import.meta.url),
    promptText,
});
