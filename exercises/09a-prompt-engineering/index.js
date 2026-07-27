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
    numCases: 1,
});

// This copy's prompt is meant to stay the naive baseline — do your actual editing in
// exercises/09b-process/index.js and run `npm run 09b` instead.
async function runPrompt(promptInputs) {
    const prompt = `What should this person eat?

- Height: ${promptInputs.height}
- Weight: ${promptInputs.weight}
- Goal: ${promptInputs.goal}
- Dietary restrictions: ${promptInputs.restrictions}`;

    const messages = [];
    addUserMessage(messages, prompt);
    return chat(messages);
}

await evaluator.runEvaluation({
    runPromptFunction: runPrompt,
    datasetFile: new URL('output/dataset.json', import.meta.url),
    extraCriteria: `The output should include:
- Daily caloric total
- Macronutrient breakdown
- Meals with exact foods, portions, and timing`,
    jsonOutputFile: new URL('output/output.json', import.meta.url),
    htmlOutputFile: new URL('output/output.html', import.meta.url),
});
