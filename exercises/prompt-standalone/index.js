import { addUserMessage, chat } from './partials/basicChat.js';
import { PromptEvaluator } from './partials/promptEvaluator.js';

const evaluator = new PromptEvaluator({ maxConcurrentTasks: 1 });

// Creates a small set of realistic test scenarios for the task described below (e.g. a
// customer with a damaged item, one with a late delivery, etc.) and saves them to
// output/dataset.json, so the same scenarios are reused every time you re-run this file.
const dataset = await evaluator.generateDataset({
    taskDescription: 'Write a professional customer support email reply to a customer inquiry or complaint',
    promptInputsSpec: {
        customerName: "Customer's name",
        issue: "Description of the customer's problem or request",
        orderDetails: 'Relevant order or account details',
        desiredOutcome: 'What resolution the customer is hoping for',
    },
    outputFile: new URL('output/dataset.json', import.meta.url),
    // How many test cases to generate and score. More test cases give a more reliable
    // score, but the evaluation also takes longer to run.
    numCases: 3,
});

// This is the prompt being tested. Change the text below, then run `npm start`
// again to see how your edit changes the score.
function buildPrompt(promptInputs) {
    return `Reply to this customer in one short sentence.
    - Name: ${promptInputs.customerName}
    - Issue: ${promptInputs.issue}
    - Order details: ${promptInputs.orderDetails}
    - Desired outcome: ${promptInputs.desiredOutcome}
`;
}

async function runPrompt(promptInputs) {
    const messages = [];
    addUserMessage(messages, buildPrompt(promptInputs));
    return chat(messages);
}

const promptText = buildPrompt({
    customerName: '{customerName}',
    issue: '{issue}',
    orderDetails: '{orderDetails}',
    desiredOutcome: '{desiredOutcome}',
});

// Runs the prompt above against every test case in the dataset, grades each reply against
// the criteria below, and writes the scores and outputs to output/output.html.
await evaluator.runEvaluation({
    runPromptFunction: runPrompt,
    datasetFile: new URL('output/dataset.json', import.meta.url),
    extraCriteria: `The output should include:
- A greeting that uses the customer's name
- A clear acknowledgment of their specific issue
- A concrete next step or resolution
- A professional, warm closing`,
    jsonOutputFile: new URL('output/output.json', import.meta.url),
    htmlOutputFile: new URL('output/output.html', import.meta.url),
    promptText,
});
