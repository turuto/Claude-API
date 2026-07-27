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

// Your working copy — starts as the same naive prompt as 09a. Edit the prompt text below
// and re-run `npm run 09b` to apply prompt engineering techniques and watch the score
// change, one change at a time. See exercises/09c-solution for one possible engineered
// version and a side-by-side comparison against the original naive baseline.
function buildPrompt(promptInputs) {
    return `Generate a one-day meal plan for an athlete that meets their dietary restrictions.
<athlete-data>
    - Height: ${promptInputs.height}
    - Weight: ${promptInputs.weight}
    - Goal: ${promptInputs.goal}
    - Dietary restrictions: ${promptInputs.restrictions}
</athlete-data>

Guidelines:
1. Include accurate daily calorie amount
2. Show protein, fat, and carb amounts
3. Specify when to eat each meal
4. Use only foods that fit restrictions
5. List all portion sizes in grams
6. Keep budget-friendly if mentioned

This is an example of ideal output based on the input
<sample-input>
    height: 188 cm
    weight: 120 kg
    goal: muscle gain and strength recovery
    restrictions: none
</sample-input>

<ideal-output>
    # One-Day Meal Plan for Muscle Gain & Strength Recovery

    ## Daily Nutritional Targets
    - **Calories:** 3,500 kcal
    - **Protein:** 200g (2.3g per kg bodyweight)
    - **Carbohydrates:** 437g
    - **Fat:** 97g

    ---

    ## BREAKFAST (7:00 AM)
    **Oatmeal Power Bowl**
    - Rolled oats: 100g
    - Whole eggs: 3 (180g)
    - Banana: 150g
    - Almond butter: 30g
    - Honey: 20g

    **Macros:** 780 kcal | 28g protein | 105g carbs | 23g fat

    ---

    ## MID-MORNING SNACK (10:00 AM)
    **Protein Shake**
    - Whey protein powder: 40g
    - Whole milk: 300ml
    - Oats: 50g
    - Berries (frozen): 100g

    **Macros:** 480 kcal | 35g protein | 48g carbs | 12g fat

    ---

    ## LUNCH (1:00 PM)
    **Grilled Chicken & Rice**
    - Chicken breast: 250g
    - White rice (cooked): 300g
    - Olive oil: 15ml
    - Mixed vegetables: 150g (broccoli, carrots)
    - Salt & pepper to taste

    **Macros:** 920 kcal | 62g protein | 95g carbs | 18g fat

    ---

    ## PRE-WORKOUT SNACK (3:30 PM)
    **Simple Carb + Protein**
    - Rice cakes: 50g (3 cakes)
    - Peanut butter: 25g
    - Orange juice: 250ml

    **Macros:** 420 kcal | 12g protein | 58g carbs | 12g fat

    ---

    ## POST-WORKOUT (5:30 PM)
    **Recovery Shake**
    - Whey protein: 45g
    - Dextrose powder: 50g
    - Banana: 120g
    - Water: 300ml

    **Macros:** 390 kcal | 40g protein | 62g carbs | 1g fat

    ---

    ## DINNER (7:30 PM)
    **Lean Beef & Sweet Potato**
    - Ground beef (90/10): 280g
    - Sweet potato (baked): 350g
    - Broccoli: 200g
    - Olive oil: 10ml

    **Macros:** 850 kcal | 52g protein | 85g carbs | 20g fat

    ---

    ## EVENING SNACK (9:30 PM)
    **Casein-Rich Bedtime Snack**
    - Greek yogurt (0%): 250g
    - Granola: 40g
    - Honey: 15g

    **Macros:** 260 kcal | 25g protein | 34g carbs | 2g fat

    ---

    ## Daily Totals
    - **Calories:** 4,100 kcal ✓
    - **Protein:** 254g ✓
    - **Carbohydrates:** 487g ✓
    - **Fat:** 88g ✓

    **Notes:**
    - Adjust portion sizes based on actual hunger and recovery feedback
    - Hydrate with 3-4 liters of water daily
    - Post-workout meal should be within 30-60 minutes of training
    - This plan supports muscle growth and strength recovery for your size and goals
</ideal-output>

The solution comprehensively satisfies all mandatory requirements with clear daily totals,
detailed macronutrient breakdowns, and seven meals with exact portions and timing.
The protein distribution (254g) strongly supports the muscle gain and strength recovery goal.
The meal plan is practical and appropriately calorie-dense for a 120kg athlete.
The only notable issue is a minor 100-calorie overage beyond the stated 3,500-4,000 range, which is negligible.
The plan meets all secondary criteria regarding whole foods, meal coverage, and appropriate caloric intake.
While additional preparation guidance would enhance usability, it was not required by the criteria.

`;
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
