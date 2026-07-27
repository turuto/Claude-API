import { average } from './mathUtils.js';

// The prompt often contains tags like <customer-message> — without this, a browser would
// treat those as HTML instead of showing them as plain text in the report.
function escapeHtml(text) {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Builds the HTML report file you open in a browser after each run: the overall score,
// pass rate, and a row per test case showing its inputs, the output, and the grading.
export function generatePromptEvaluationReport(results, promptText) {
    const scores = results.map((result) => result.score);
    const totalTests = results.length;
    const avgScore = scores.length ? average(scores) : 0;
    const maxPossibleScore = 10;
    const passRate = totalTests ? (100 * scores.filter((score) => score >= 7).length) / totalTests : 0;

    const rows = results
        .map((result) => {
            const promptInputsHtml = Object.entries(result.testCase.prompt_inputs)
                .map(([key, value]) => `<strong>${key}:</strong> ${value}`)
                .join('<br>');

            const criteriaString = result.testCase.solution_criteria.join('<br>• ');

            let scoreClass = 'score-medium';
            if (result.score >= 8) {
                scoreClass = 'score-high';
            } else if (result.score <= 5) {
                scoreClass = 'score-low';
            }

            return `
            <tr>
                <td>${result.testCase.scenario}</td>
                <td class="prompt-inputs">${promptInputsHtml}</td>
                <td class="criteria">• ${criteriaString}</td>
                <td class="output"><pre>${result.output}</pre></td>
                <td class="score-col"><span class="score ${scoreClass}">${result.score}</span></td>
                <td class="reasoning">${result.reasoning}</td>
            </tr>
        `;
        })
        .join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Prompt Evaluation Report</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            margin: 0;
            padding: 20px;
            color: #333;
        }
        .header {
            background-color: #f0f0f0;
            padding: 20px;
            border-radius: 5px;
            margin-bottom: 20px;
        }
        .summary-stats {
            display: flex;
            justify-content: space-between;
            flex-wrap: wrap;
            gap: 10px;
        }
        .stat-box {
            background-color: #fff;
            border-radius: 5px;
            padding: 15px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
            flex-basis: 30%;
            min-width: 200px;
        }
        .stat-value {
            font-size: 24px;
            font-weight: bold;
            margin-top: 5px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
        }
        th {
            background-color: #4a4a4a;
            color: white;
            text-align: left;
            padding: 12px;
        }
        td {
            padding: 10px;
            border-bottom: 1px solid #ddd;
            vertical-align: top;
        }
        tr:nth-child(even) {
            background-color: #f9f9f9;
        }
        .output-cell {
            white-space: pre-wrap;
        }
        .score {
            font-weight: bold;
            padding: 5px 10px;
            border-radius: 3px;
            display: inline-block;
        }
        .score-high {
            background-color: #c8e6c9;
            color: #2e7d32;
        }
        .score-medium {
            background-color: #fff9c4;
            color: #f57f17;
        }
        .score-low {
            background-color: #ffcdd2;
            color: #c62828;
        }
        .output {
            overflow: auto;
            white-space: pre-wrap;
        }
        .output pre {
            background-color: #f5f5f5;
            border: 1px solid #ddd;
            border-radius: 4px;
            padding: 10px;
            margin: 0;
            font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
            font-size: 14px;
            line-height: 1.4;
            color: #333;
            box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.1);
            overflow-x: auto;
            white-space: pre-wrap;
            word-wrap: break-word;
        }
        .prompt-preview {
            background-color: #fff;
            border: 1px solid #ddd;
            border-radius: 4px;
            padding: 12px;
            margin: 12px 0 20px;
        }
        .prompt-preview summary {
            cursor: pointer;
            font-weight: bold;
        }
        .prompt-preview pre {
            margin: 10px 0 0;
            font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
            font-size: 14px;
            line-height: 1.4;
            color: #333;
            overflow-x: auto;
            white-space: pre-wrap;
            word-wrap: break-word;
        }
        td {
            width: 20%;
        }
        .score-col {
            width: 80px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Prompt Evaluation Report</h1>
        ${
            promptText
                ? `<details class="prompt-preview">
            <summary>View prompt</summary>
            <pre>${escapeHtml(promptText)}</pre>
        </details>`
                : ''
        }
        <div class="summary-stats">
            <div class="stat-box">
                <div>Total Test Cases</div>
                <div class="stat-value">${totalTests}</div>
            </div>
            <div class="stat-box">
                <div>Average Score</div>
                <div class="stat-value">${avgScore.toFixed(1)} / ${maxPossibleScore}</div>
            </div>
            <div class="stat-box">
                <div>Pass Rate (≥7)</div>
                <div class="stat-value">${passRate.toFixed(1)}%</div>
            </div>
        </div>
    </div>

    <table>
        <thead>
            <tr>
                <th>Scenario</th>
                <th>Prompt Inputs</th>
                <th>Solution Criteria</th>
                <th>Output</th>
                <th>Score</th>
                <th>Reasoning</th>
            </tr>
        </thead>
        <tbody>
${rows}
        </tbody>
    </table>
</body>
</html>
`;
}
