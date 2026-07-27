import { addUserMessage, chat } from './partials/basicChat.js';
import { PromptEvaluator } from './partials/promptEvaluator.js';
import { average } from './partials/mathUtils.js';
import { buildNaiveMealPlanPrompt, buildEngineeredMealPlanPrompt } from './partials/mealPlanPrompts.js';

// Reuses the dataset index.js already generated instead of generating a fresh one — run
// `npm run 09c-solution` first if output/dataset.json doesn't exist yet. Grading both
// prompts against the exact same test case(s) is what makes the two averages comparable;
// a fresh dataset per run would risk one prompt facing an easier or harder scenario than
// the other by chance.
const datasetFile = new URL('output/dataset.json', import.meta.url);

const evaluator = new PromptEvaluator({ maxConcurrentTasks: 1 });

const extraCriteria = `The output should include:
- Daily caloric total
- Macronutrient breakdown
- Meals with exact foods, portions, and timing`;

async function runNaivePrompt(promptInputs) {
    const messages = [];
    addUserMessage(messages, buildNaiveMealPlanPrompt(promptInputs));
    return chat(messages);
}

async function runEngineeredPrompt(promptInputs) {
    const messages = [];
    addUserMessage(messages, buildEngineeredMealPlanPrompt(promptInputs));
    return chat(messages);
}

// Placeholder values, not a real test case — just so each report can show its prompt
// template without needing an extra API call to fill it in with real data.
const placeholderInputs = { height: '{height}', weight: '{weight}', goal: '{goal}', restrictions: '{restrictions}' };

console.log('--- Naive baseline ---');
const naiveResults = await evaluator.runEvaluation({
    runPromptFunction: runNaivePrompt,
    datasetFile,
    extraCriteria,
    jsonOutputFile: new URL('output/baseline-naive.json', import.meta.url),
    htmlOutputFile: new URL('output/baseline-naive.html', import.meta.url),
    promptText: buildNaiveMealPlanPrompt(placeholderInputs),
});

console.log('\n--- Engineered prompt ---');
const engineeredResults = await evaluator.runEvaluation({
    runPromptFunction: runEngineeredPrompt,
    datasetFile,
    extraCriteria,
    jsonOutputFile: new URL('output/baseline-engineered.json', import.meta.url),
    htmlOutputFile: new URL('output/baseline-engineered.html', import.meta.url),
    promptText: buildEngineeredMealPlanPrompt(placeholderInputs),
});

console.log(`\nNaive average:      ${average(naiveResults.map((result) => result.score))}`);
console.log(`Engineered average: ${average(engineeredResults.map((result) => result.score))}`);
