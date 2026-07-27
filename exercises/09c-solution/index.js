import { addUserMessage, chat } from './partials/basicChat.js';
import { PromptEvaluator } from './partials/promptEvaluator.js';
import { buildEngineeredMealPlanPrompt } from './partials/mealPlanPrompts.js';

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

// See partials/mealPlanPrompts.js for the prompt text itself, and compare-baseline.js for
// a side-by-side run against the naive baseline this was engineered from.
async function runPrompt(promptInputs) {
    const messages = [];
    addUserMessage(messages, buildEngineeredMealPlanPrompt(promptInputs));
    return chat(messages);
}

// Placeholder values, not a real test case — just so the report can show the prompt
// template without needing an extra API call to fill it in with real data.
const promptText = buildEngineeredMealPlanPrompt({
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
