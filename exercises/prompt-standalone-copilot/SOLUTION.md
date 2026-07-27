# Improving the prompt

The prompt in `index.js` right now is deliberately bare — it just hands Claude the customer's
details in one short-sentence instruction, with no guidance on what a good reply looks like. Run
`npm start` and open `output/output.html` to see the starting score; it usually comes back low
(around 3-4/10), because Claude has to guess what "good" means here and the one-sentence
constraint makes it impossible to hit every grading criterion at once.

Below is a real run through [THEORY.md](./THEORY.md)'s four tips, applied one at a time to this
project's own starting prompt, with the actual score measured after each change. After each
change, save `index.js` and run `npm start` again — compare the new report against the previous
one (it's kept as `output001.html`, `output002.html`, ...) to see the score move.

Note: `npm start` regenerates the test dataset every run, so the exact scores below will drift a
little if you reproduce them yourself — what matters is the direction each change pushes the
average, not the exact decimal.

## Starting point

A vague, indirect opening leaves the task itself ambiguous:

```
What should I say back to this customer?
    - Name: ${promptInputs.customerName}
    - Issue: ${promptInputs.issue}
    - Order details: ${promptInputs.orderDetails}
    - Desired outcome: ${promptInputs.desiredOutcome}
```

**Score: 7.7/10** — Claude can usually still infer "write a reply" from context, but it's guessing
at the task, the format, and every constraint at once.

## 1. Be clear and direct

Replace the vague question with a direct instruction that opens with an action verb:

```diff
- What should I say back to this customer?
+ Write a customer support email reply to the message below.
```

**Score: 8.0/10** — a small bump. The task itself was already inferable from context, so this tip
matters most when the opening line is genuinely ambiguous about what's being asked for.

## 2. Be specific

Add a numbered list of guidelines so Claude doesn't have to guess what you actually care about:

```
Guidelines:
1. Greet the customer by name
2. Acknowledge their specific issue
3. Reference the relevant order or account details
4. Clearly state what will happen next
5. Keep a warm, professional tone
6. Sign off with a support team name
```

**Score: 9.3/10** — the single biggest jump of the four tips, matching THEORY.md's prediction.
The checklist turns a vague task into something checkable, and it happens to mirror what the
grader itself checks for.

## 3. Structure input with tags

Wrap the customer's details in a descriptive tag so the input is clearly delimited from the
instructions:

```diff
  Write a customer support email reply to the message below.
+ <customer-message>
      - Name: ${promptInputs.customerName}
      - Issue: ${promptInputs.issue}
      - Order details: ${promptInputs.orderDetails}
      - Desired outcome: ${promptInputs.desiredOutcome}
+ </customer-message>
```

**Score: 9.0/10** — roughly a wash here, as THEORY.md predicts ("the gain is modest for a short
block like this one"). The input is short enough that Claude wasn't really confused about where
it ended, so tagging mostly pays off on longer or more mixed inputs.

## 4. Provide an example

Add one worked example, plus a sentence on *why* it's good:

```
This is an example of ideal output based on the input
<sample-input>
    Name: Priya
    Issue: Received a damaged blender in her last order and wants a replacement
    Order details: Order #48213, placed 5 days ago, blender model BX-500
    Desired outcome: A free replacement shipped as soon as possible
</sample-input>

<ideal-output>
Subject: Your damaged blender (Order #48213) — replacement on the way

Hi Priya,

I'm really sorry to hear the BX-500 blender from your order (#48213) arrived damaged — that's not
the experience we want you to have.

I've gone ahead and arranged a free replacement, which will ship within 1 business day. You'll get
a tracking link by email as soon as it's on its way, and there's nothing further you need to do —
no need to return the damaged unit.

If anything else comes up with the replacement, just reply to this email and we'll take care of it
right away.

Thanks for your patience, Priya!

Warm regards,
The Support Team
</ideal-output>

This reply greets Priya by name, directly acknowledges the damaged blender, references order #48213
and the BX-500 model, clearly states the resolution (a free replacement shipping within 1 business
day) and what she needs to do (nothing), and closes on a warm, professional note.
```

**Score: 7.3/10 (dropped)** — a single example doesn't just fail to help here, it hurts. Every
generated test case invents its own extra secondary criteria (explaining a policy, confirming
missing details, matching tone to the customer), and one example anchors Claude too strongly on
the damaged-item script instead of generalizing. This matches the warning in THEORY.md: examples
are the most expensive of the four tips, and a single one can teach the wrong lesson if the real
traffic is more varied than the example.

### 4b. Add a second, different example

THEORY.md and the "other things to try" below both suggest a second example covering a different
kind of issue helps Claude generalize instead of copying the first one too closely. Added a
billing/price-adjustment example alongside the damaged-item one:

**Score: 8.3/10** — recovers most of the regression, but still short of the guideline-only score
from step 2. Two examples generalize better than one, but they still can't cover the full range of
scenario-specific asks the test generator invents (see below).

## 5. Tighten the guidelines to match what's actually being graded

Reading the low-scoring cases' reasoning showed a pattern: replies were losing points not on the
six original guidelines, but on things like "didn't give a follow-up contact method" or "didn't
give step-by-step instructions." Rather than chase each gap individually, the guidelines were
broadened to cover the *class* of things the grader kept asking for — concrete detail, a way to
follow up, and matching tone/complexity to the customer described:

```
Guidelines:
1. Greet the customer by name
2. Acknowledge their specific issue, validating any frustration they express rather than
   just noting it
3. Reference the relevant order or account details, showing you've reviewed the specifics
4. Clearly state what will happen next, with concrete detail (timeline, amount, step-by-step
   instructions if the customer needs to take an action)
5. If the situation calls for it, offer a goodwill gesture beyond the minimum fix (a discount,
   credit, or expedited shipping) and explain any relevant policy so the resolution doesn't feel
   arbitrary
6. Include a way to follow up (reply to this email, a phone number, or a support portal)
7. Match your language to the customer described — simple and jargon-free for a non-technical
   or elderly customer, more direct and efficient for others
8. Keep a warm, professional tone
9. Sign off with a support team name
```

**Score: 8.7/10** — close to, but not consistently over, 9/10. This is close to the ceiling this
setup can reliably hit: because `npm start` regenerates a brand-new, randomly invented set of test
cases (and their own scenario-specific secondary criteria) on every run, the top end of the score
is genuinely a moving target — a run can hand you a scenario whose secondary criteria wander well
outside what any fixed set of guidelines anticipates (e.g. "acknowledge 8 years of loyalty with
specific purchase history"). 8.7 was judged good enough to stop here rather than chase the last
0.3 by overfitting the prompt to one run's random dataset.

## Putting it together

The final `buildPrompt`, combining a direct opening, tagged input, broadened guidelines, and two
examples:

```js
function buildPrompt(promptInputs) {
    return `Write a customer support email reply to the message below.
<customer-message>
    - Name: ${promptInputs.customerName}
    - Issue: ${promptInputs.issue}
    - Order details: ${promptInputs.orderDetails}
    - Desired outcome: ${promptInputs.desiredOutcome}
</customer-message>

Guidelines:
1. Greet the customer by name
2. Acknowledge their specific issue, validating any frustration they express rather than
   just noting it
3. Reference the relevant order or account details, showing you've reviewed the specifics
4. Clearly state what will happen next, with concrete detail (timeline, amount, step-by-step
   instructions if the customer needs to take an action)
5. If the situation calls for it, offer a goodwill gesture beyond the minimum fix (a discount,
   credit, or expedited shipping) and explain any relevant policy so the resolution doesn't feel
   arbitrary
6. Include a way to follow up (reply to this email, a phone number, or a support portal)
7. Match your language to the customer described — simple and jargon-free for a non-technical
   or elderly customer, more direct and efficient for others
8. Keep a warm, professional tone
9. Sign off with a support team name

This is an example of ideal output based on the input
<sample-input>
    Name: Priya
    Issue: Received a damaged blender in her last order and wants a replacement
    Order details: Order #48213, placed 5 days ago, blender model BX-500
    Desired outcome: A free replacement shipped as soon as possible
</sample-input>

<ideal-output>
Subject: Your damaged blender (Order #48213) — replacement on the way

Hi Priya,

I'm really sorry to hear the BX-500 blender from your order (#48213) arrived damaged — that's not
the experience we want you to have.

I've gone ahead and arranged a free replacement, which will ship within 1 business day. You'll get
a tracking link by email as soon as it's on its way, and there's nothing further you need to do —
no need to return the damaged unit.

If anything else comes up with the replacement, just reply to this email and we'll take care of it
right away.

Thanks for your patience, Priya!

Warm regards,
The Support Team
</ideal-output>

This reply greets Priya by name, directly acknowledges the damaged blender, references order #48213
and the BX-500 model, clearly states the resolution (a free replacement shipping within 1 business
day) and what she needs to do (nothing), and closes on a warm, professional note.

Here is a second example, for a different kind of issue
<sample-input>
    Name: Jordan
    Issue: Found the same item cheaper elsewhere after buying it, and wants a partial refund for the
    difference. Also asks whether this is something the store normally allows.
    Order details: Order #77021, placed 3 days ago, AirSound Pro wireless earbuds
    Desired outcome: A partial refund for the price difference
</sample-input>

<ideal-output>
Subject: Price adjustment for your AirSound Pro order (#77021)

Hi Jordan,

Thanks for reaching out, and good catch on the price difference! Our policy allows a one-time price
adjustment for orders placed within the last 7 days, so your order (#77021) qualifies.

I've refunded the difference back to your original payment method — you should see it within
3-5 business days. No further action is needed on your end.

Let us know if you have any other questions!

Warm regards,
The Support Team
</ideal-output>

This reply greets Jordan by name, acknowledges the price-match request, references order #77021 and
the AirSound Pro earbuds, explains the relevant policy so Jordan understands why the request was
approved, clearly states the resolution and timeline, and closes on a warm, professional note.
`;
}
```

## Score summary

| Step                                   | Score    |
| --------------------------------------- | -------- |
| Starting point (vague opening)          | 7.7 / 10 |
| 1. Be clear and direct                  | 8.0 / 10 |
| 2. Be specific (guidelines)             | 9.3 / 10 |
| 3. Structure input with tags            | 9.0 / 10 |
| 4. Provide an example (one)             | 7.3 / 10 |
| 4b. Provide an example (two)            | 8.3 / 10 |
| 5. Tighten guidelines to match grading  | 8.7 / 10 |

The lesson isn't "each tip strictly improves the score" — tip 4 shows a technique from THEORY.md
can *regress* the score if applied naively (one example, over-anchoring). The point of scoring
after every single change is to catch that regression immediately, rather than lump it in with
other changes and wrongly credit or blame the wrong technique.

## Other things to try

- **Be specific about tone and length** — "warm, professional tone" can be tightened further
  (e.g. "2-3 short paragraphs, no corporate jargon") if the report shows replies running too long
  or too stiff.
- **Tighten `extraCriteria`** in `index.js` — the grader only enforces what's listed there as
  mandatory. If the report shows replies losing points for something not in that list, add it; if
  it's scoring things you don't actually care about, trim it.
- **Increase `numCases`** in `index.js` — averaging over more test cases smooths out the kind of
  run-to-run variance seen in step 5, at the cost of a slower `npm start`.
