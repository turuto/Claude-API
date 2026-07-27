import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { addUserMessage, addAssistantMessage } from './basicChat.js';
import { chatJson } from './jsonUtils.js';
import { mapWithConcurrency, createProgressLogger } from './concurrency.js';
import { average } from './mathUtils.js';
import { buildIdeasPrompt, buildTestCasePrompt, buildEvalPrompt } from './prompts.js';
import { generatePromptEvaluationReport } from './report.js';

export class PromptEvaluator {
    constructor({ maxConcurrentTasks = 3 } = {}) {
        this.maxConcurrentTasks = maxConcurrentTasks;
    }

    async generateUniqueIdeas(taskDescription, promptInputsSpec, numCases) {
        const messages = [];
        addUserMessage(messages, buildIdeasPrompt(taskDescription, promptInputsSpec, numCases));
        addAssistantMessage(messages, '```json');

        return chatJson(messages, {
            stopSequences: ['```'],
            system: 'You are a test scenario designer specialized in creating diverse, unique testing scenarios.',
        });
    }

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

    async gradeOutput(testCase, output, extraCriteria) {
        const messages = [];
        addUserMessage(messages, buildEvalPrompt(testCase, output, extraCriteria));
        addAssistantMessage(messages, '```json');

        return chatJson(messages, { stopSequences: ['```'], temperature: 0.0 });
    }

    async runTestCase(testCase, runPromptFunction, extraCriteria) {
        const output = await runPromptFunction(testCase.prompt_inputs);
        const modelGrade = await this.gradeOutput(testCase, output, extraCriteria);

        return { output, testCase, score: modelGrade.score, reasoning: modelGrade.reasoning };
    }

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
        await writeFile(htmlOutputFile, generatePromptEvaluationReport(results, promptText));

        return results;
    }
}
