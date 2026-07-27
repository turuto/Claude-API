# Improving the prompt

The prompt in `index.js` right now is deliberately bare — it just hands Claude the
customer's details with no guidance on what a good reply looks like. Run `npm start` and
open `output/output.html` to see the starting score; it usually comes back low or
inconsistent, because Claude has to guess what "good" means here.

Below are the improvements to try, roughly in order of impact. After each change, save
`index.js` and run `npm start` again — compare the new report against the previous one
(it's kept as `output001.html`, `output002.html`, ...) to see the score move.

## 1. Add explicit guidelines

Tell Claude exactly what a good reply must contain, instead of leaving it to infer:

```
Guidelines:
1. Greet the customer by name
2. Acknowledge their specific issue
3. Reference the relevant order or account details
4. Clearly state what will happen next
5. Keep a warm, professional tone
6. Sign off with a support team name
```

This alone tends to move the score the most — it turns a vague task into a checklist the
model can follow, and the checklist matches what the grader below is scoring against.

## 2. Add a worked example (few-shot)

Show one full example of a customer message and the ideal reply to it. Seeing a concrete
example is more effective than describing the format in the abstract:

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
```

## 3. Explain *why* the example is ideal

Right after the example, spell out which guidelines it satisfies and how. This reinforces
the connection between the example and the checklist from step 1, rather than leaving
Claude to notice the pattern on its own:

```
This reply greets Priya by name, directly acknowledges the damaged blender, references order #48213
and the BX-500 model, clearly states the resolution (a free replacement shipping within 1 business
day) and what she needs to do (nothing), and closes on a warm, professional note.
```

## Putting it together

Combining all three, `buildPrompt` becomes:

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
2. Acknowledge their specific issue
3. Reference the relevant order or account details
4. Clearly state what will happen next
5. Keep a warm, professional tone
6. Sign off with a support team name

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
`;
}
```

## Other things to try

- **Be specific about tone and length** — "warm, professional tone" can be tightened
  further (e.g. "2-3 short paragraphs, no corporate jargon") if the report shows replies
  running too long or too stiff.
- **Add a second, different example** — one example teaches the format; a second one
  covering a different kind of issue (e.g. a billing question instead of a damaged item)
  helps Claude generalize instead of copying the first example too closely.
- **Tighten `extraCriteria`** in `index.js` — the grader only enforces what's listed there
  as mandatory. If the report shows replies losing points for something not in that list,
  add it; if it's scoring things you don't actually care about, trim it.
