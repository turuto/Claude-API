import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { addUserMessage, addAssistantMessage } from './basicChat.js';
import { chatJson } from './jsonUtils.js';
import { mapWithConcurrency, createProgressLogger } from './concurrency.js';
import { average } from './mathUtils.js';
import { buildIdeasPrompt, buildTestCasePrompt, buildEvalPrompt } from './prompts.js';
import { generatePromptEvaluationReport } from './report.js';
import { archiveIfExists } from './archive.js';

// Everything below runs behind the scenes when you call `npm start` — it generates test
// cases, runs your prompt against each one, grades the results, and writes the report.
// You shouldn't need to change anything in this file to test your own prompt.
export class PromptEvaluator {
    constructor({ maxConcurrentTasks = 3 } = {}) {
        this.maxConcurrentTasks = maxConcurrentTasks;
    }

    // Asks Claude to brainstorm a handful of different scenarios to test the prompt with.
    async generateUniqueIdeas(taskDescription, promptInputsSpec, numCases) {
        const messages = [];
        addUserMessage(messages, buildIdeasPrompt(taskDescription, promptInputsSpec, numCases));
        addAssistantMessage(messages, '```json');

        return chatJson(messages, {
            stopSequences: ['```'],
            system: 'You are a test scenario designer specialized in creating diverse, unique testing scenarios.',
        });
    }

    // Turns one scenario into a full test case: example inputs, plus the criteria that
    // will be used to judge the output.
    async generateTestCase(taskDescription, idea, promptInputsSpec) {
        const messages = [];
        addUserMessage(messages, buildTestCasePrompt(taskDescription, idea, promptInputsSpec));
        addAssistantMessage(messages, '```json');

        const testCase = await chatJson(messages, {
            stopSequences: ['```'],
            system: 'You are a test case creator specializing in designing evaluation scenarios.',
            temperature: 0.7,
        });

        testCase.task_description = taskDescription;
        testCase.scenario = idea;

        return testCase;
    }

    // Builds the full set of test cases and saves them to a file, so the same dataset can
    // be reused every time you re-run the evaluation against an edited prompt.
    async generateDataset({ taskDescription, promptInputsSpec = {}, numCases = 1, outputFile }) {
        const ideas = await this.generateUniqueIdeas(taskDescription, promptInputsSpec, numCases);

        const logProgress = createProgressLogger('Generated', ideas.length);
        const dataset = await mapWithConcurrency(ideas, this.maxConcurrentTasks, async (idea) => {
            const testCase = await this.generateTestCase(taskDescription, idea, promptInputsSpec);
            logProgress();
            return testCase;
        });

        await mkdir(new URL('.', outputFile), { recursive: true });
        await writeFile(outputFile, JSON.stringify(dataset, null, 2));

        return dataset;
    }

    // Asks Claude to score one output against that test case's criteria, from 1 to 10.
    async gradeOutput(testCase, output, extraCriteria) {
        const messages = [];
        addUserMessage(messages, buildEvalPrompt(testCase, output, extraCriteria));
        addAssistantMessage(messages, '```json');

        return chatJson(messages, { stopSequences: ['```'], temperature: 0.0 });
    }

    // Runs your prompt for one test case, then grades the result it produced.
    async runTestCase(testCase, runPromptFunction, extraCriteria) {
        const output = await runPromptFunction(testCase.prompt_inputs);
        const modelGrade = await this.gradeOutput(testCase, output, extraCriteria);

        return { output, testCase, score: modelGrade.score, reasoning: modelGrade.reasoning };
    }

    // Runs every test case in the dataset, prints the average score, and writes the HTML
    // report you open in a browser.
    async runEvaluation({ runPromptFunction, datasetFile, extraCriteria, jsonOutputFile, htmlOutputFile, promptText }) {
        const dataset = JSON.parse(await readFile(datasetFile, 'utf-8'));

        const logProgress = createProgressLogger('Graded', dataset.length);
        const results = await mapWithConcurrency(dataset, this.maxConcurrentTasks, async (testCase) => {
            const result = await this.runTestCase(testCase, runPromptFunction, extraCriteria);
            logProgress();
            return result;
        });

        console.log(`Average score: ${average(results.map((result) => result.score))}`);

        await mkdir(new URL('.', jsonOutputFile), { recursive: true });
        await writeFile(jsonOutputFile, JSON.stringify(results, null, 2));
        await archiveIfExists(htmlOutputFile);
        await writeFile(htmlOutputFile, generatePromptEvaluationReport(results, promptText));

        return results;
    }
}
