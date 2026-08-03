# Prompting techniques for image analysis

Simple prompts on images ("how many marbles are in this picture?") tend to
undercount or otherwise get it wrong more often than the same kind of prompt
does on text. The same prompt-engineering techniques that improve text
results apply to images too — they just matter more.

## Step-by-step methodology

Instead of asking for an answer directly, spell out how to get there:

```
Analyze this image of marbles and determine the exact count using this methodology:
1. Identify each unique marble one at a time, assigning each a number as you go.
2. Verify your result with a different method: count row by row, from
   left to right, starting at the bottom-left corner.

What is the exact, verified number of marbles in this image?
```

Forcing a first pass plus an independent re-check catches the miscounts a
single glance produces.

## One-shot / multi-shot examples

Include a reference image with a *known* correct answer before asking about
the real target image — same idea as text few-shot prompting, just with an
image as the example instead of a text sample. Gives Claude a concrete
reference point for the level of care/format expected.

## Real-world example: fire risk assessment (this exercise's demo)

`index.js` runs this pattern on a satellite image, for an insurance use case:
instead of sending an inspector to every property, break "what's the fire
risk here?" into an explicit checklist Claude walks through:

1. Locate the primary residence.
2. Examine tree canopy overhang on the roof (and estimate % coverage).
3. Assess ember/fuel-path fire risk from that overhang.
4. Assess overall defensible space / fuel ladders on the property.
5. Only *then* assign a 1–4 risk rating, with one justifying sentence per
   step above.

A bare "give me a fire risk score" prompt skips all the reasoning that makes
the final number trustworthy — the structure is what makes the output
auditable, not just an opinion Claude asserts.
