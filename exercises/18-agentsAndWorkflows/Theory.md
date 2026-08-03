# Agents and Workflows

Workflows and agents are two strategies for handling user tasks that can't be
completed by Claude in a single request. You've actually been building both
throughout this course — any time you gave Claude tools and let it figure out
how to complete a task, that was an agent.

## Workflows vs. Agents

The decision comes down to how well you understand the task ahead of time:

- **Workflows** — a series of calls to Claude meant to solve a specific
  problem through a predetermined series of steps. Use these when you can
  picture the exact flow or steps Claude should go through to solve a
  problem, or when your app's UX constrains users to a set of tasks.
- **Agents** — Claude is given a goal and a set of tools, and is expected to
  figure out how to complete the goal through the provided tools. Use these
  when you're not sure exactly what task or task parameters will be given to
  Claude.

### Example: image → STEP file workflow

Imagine a web app where a user drags and drops an image of a metal part, and
the app produces a STEP file (an industry-standard 3D model format) from it.
Since there's a clear, predefined series of steps to go from image to model,
this is a good workflow candidate rather than an agent:

1. Feed an image into Claude, asking it to describe the object.
2. Based on the description, ask Claude to use the CadQuery library to model
   the object.
3. Create a rendering of the model.
4. Ask Claude to grade the rendering against the original image. If there are
   issues, fix them.

## The Evaluator-Optimizer Pattern

The modeling workflow above is an example of the evaluator-optimizer pattern:

- **Producer** — takes input and creates output (Claude using CadQuery to
  model the part and create a rendering).
- **Grader** — evaluates the output against some criteria.
- **Feedback loop** — if the grader doesn't accept the output, feedback goes
  back to the producer for improvement.
- **Iteration** — the cycle repeats until the grader accepts the output.

## Why Learn Workflow Patterns

Identifying workflow patterns like evaluator-optimizer gives you a set of
repeatable recipes for implementing your own features — they've worked well
for other engineers, so they're worth applying to your own projects.
Identifying the pattern doesn't do anything by itself, though: you still have
to write the code that implements it.

## Parallelization Workflows

Some tasks look simple on the surface but become hard to get right in a
single prompt. Parallelization is a pattern for breaking a complex task into
several focused, independent pieces that run at the same time.

### The problem with a single complex prompt

Imagine a material designer app: a user uploads an image of a part, and the
app recommends the best material to use (metal, polymer, ceramic, composite,
elastomer, or wood).

- Sending the image with one simple prompt asking Claude to pick a material
  works, but without specific criteria per material, results aren't reliable.
- Cramming detailed criteria for every material into one massive prompt
  doesn't fix this — now Claude has to juggle many different considerations
  at once, which leads to confusion and worse results.

### A better approach: parallelization

Instead of one giant request, split the task into multiple parallel requests,
each evaluating the part against a single material's specialized criteria:

1. Send the same image to Claude multiple times simultaneously — once per
   material — each with its own specialized criteria (metal criteria,
   polymer criteria, ceramic criteria, etc.).
2. Claude evaluates the part's suitability for each material independently.
3. Collect all the individual analysis results.
4. Send all the results back to Claude in a final aggregation step, asking it
   to compare them and make a final material recommendation.

### How it works, generally

1. **Split** a single task into multiple sub-tasks — break the complex
   decision into focused, specialized evaluations.
2. **Run** the sub-tasks in parallel — execute all evaluations simultaneously
   for faster processing.
3. **Aggregate** the results together — combine the specialized analyses into
   a final decision.

The parallelized sub-tasks don't need to be identical — each can have its own
specialized prompt, set of tools, or evaluation criteria.

### Benefits

- **Focused attention** — Claude concentrates on one aspect at a time instead
  of balancing multiple competing considerations, leading to more thorough,
  accurate analysis per sub-task.
- **Easier optimization** — each sub-task's prompt can be improved and tested
  independently; fixing the metal analysis doesn't touch the others.
- **Better scalability** — adding a new material to evaluate just means
  adding another parallel request, with no need to rewrite or worry about
  interference with existing prompts.
- **Improved reliability** — breaking down the task reduces cognitive load on
  the model, producing more consistent results.

### When to use it

Parallelization works well for a complex decision that can be broken down
into independent evaluations — multiple criteria, several options to compare,
or decisions spanning different domains of expertise. The key is that each
parallel sub-task can operate independently and contribute a distinct piece
of analysis to the final decision.

## Chaining Workflows

A chaining workflow breaks a large, complex task into smaller, *sequential*
subtasks that build on each other — as opposed to parallelization, where
sub-tasks are independent and run at the same time.

### Example: automated social video posting

A social media marketing tool that creates and posts videos automatically
could chain these steps instead of one massive prompt:

1. Find related trending topics on Twitter.
2. Select the most interesting topic (using Claude).
3. Research the topic (using Claude).
4. Write a script for a short-format video (using Claude).
5. Use an AI avatar and text-to-speech to create a video.
6. Post the video to social media.

Only some steps need Claude — chaining is also a natural place to mix in
non-LLM processing between steps (e.g. the Twitter API call, the
avatar/TTS rendering, the posting step).

### Why chain instead of one big prompt

Giving Claude one specific task at a time keeps it focused on doing that task
well, rather than juggling multiple requirements simultaneously. Benefits:

- Splits a large task into smaller, non-parallelizable subtasks (each step
  depends on the previous one's output).
- Lets you optionally do non-LLM processing between each task.
- Keeps Claude focused on one aspect of the overall task at a time.

### The long-prompt problem

A common case for chaining: content generation with many constraints at
once. For example, asking Claude to write a technical article that must:

- Not mention that it's written by an AI
- Avoid emojis
- Skip clichéd or overly casual language
- Write in a professional, technical tone

Even with all constraints clearly stated, Claude can still violate some of
them in a single pass — the output might still contain emojis, an AI
disclosure, or casual language.

### The chaining solution

Use a two-step chain instead of fighting with one massive prompt:

1. **Generation step** — send the initial prompt and accept the first result
   may not be perfect; Claude generates the article, possibly violating some
   constraints.
2. **Revision step** — send a focused follow-up request with the article
   Claude just wrote, and targeted revision instructions, e.g.:

   ```
   Revise the article provided below. Follow these steps to rewrite the article:
   1. Identify any location where the text identifies the author as an AI and remove them
   2. Find and remove all emojis
   3. Locate any cringey writing and replace it with text that would be written by a technical writer
   ```

This works because Claude can focus entirely on revision, rather than
balancing content creation with constraint adherence at the same time.

### When to use chaining

- Complex tasks with multiple requirements.
- Claude consistently ignores some constraints in long prompts.
- You need to process or validate outputs between steps.
- You want each interaction to stay focused and manageable.

Chaining can feel like extra work, but it often beats cramming everything
into a single prompt. The key is recognizing when a task is complex enough to
benefit from being broken into focused, sequential steps.

## Routing Workflows

Routing solves the problem of different request types needing different
handling: instead of one generic prompt for every case, categorize the
incoming request first, then send it to a specialized pipeline for that
category.

### The problem with generic prompts

A social media marketing tool that generates video scripts from a user's
topic can't use one script-writing prompt for every topic. "Programming"
calls for educational content with clear explanations; "surfing" works
better as entertainment-focused content that emphasizes excitement and
visual appeal. A single generic prompt can't handle both well.

### Setting up content categories

Define the categories your app needs to handle, each with its own
specialized prompt template. For a video script generator, that might be:

- **Entertainment** — high-energy, culturally relevant content with trendy
  language
- **Educational** — clear, engaging explanations with relatable examples
- **Comedy** — sharp, unexpected content with clever observations and timing
- **Personal vlog** — authentic, intimate content with conversational
  storytelling
- **Reviews** — decisive, experience-based content highlighting strengths
  and weaknesses
- **Storytelling** — immersive content using vivid details and emotional
  connection

E.g. the educational template might ask Claude to "develop a clear, engaging
script that transforms complex information into digestible insights using
relatable examples and thought-provoking questions."

### How routing works in practice

Two steps:

1. **Categorization** — send the user's topic to Claude, asking it to
   categorize it into one of the predefined genres.
2. **Specialized processing** — use the category result to pick the matching
   prompt template and generate the actual content.

For example, given the topic "Python functions", the categorization call
might look like:

```
Categorize the topic of a video into one of the listed categories:
<topic>Python functions</topic>

<categories>
- Educational
- Entertainment
- Comedy
- Personal vlog
- Reviews
- Storytelling
</categories>
```

Claude responds with "Educational", so the app then uses the educational
prompt template to generate the actual script.

### Architecture

1. User input goes to a router component first.
2. The router categorizes the request using an initial Claude call.
3. Based on the category, the input is forwarded to one specific processing
   pipeline.
4. Each pipeline can have its own workflow, prompts, or tools optimized for
   that category.

The key insight: user input only goes to **one** specialized pipeline, not
all of them — this lets each pipeline be highly optimized for its specific
use case.

### When to use routing

- The app handles diverse request types that need different approaches.
- Categories that clearly cover the use cases can be defined.
- The categorization step can be handled reliably by Claude.
- The performance benefit of specialized processing outweighs the overhead
  of the extra routing step.

Especially valuable for customer service bots, content generation tools, and
any app where the "right" response depends heavily on understanding what
type of request is being made.

## Agents and Tools

Agents are a shift away from the structured workflows above. Workflows are
great when you know the exact steps needed; agents shine when you don't. You
give Claude a goal and a set of tools, and let it figure out how to combine
those tools to achieve the objective — Claude formulates its own plan
(stated or unstated) for using the provided tools.

- Goal: reliably and economically complete tasks — this is often harder to
  achieve with agents than with workflows, since you're trading control for
  flexibility.
- Benefit: agent flexibility allows for a more flexible UX — you build the
  agent once, verify it works reasonably well, and it can then handle a wide
  range of problems you didn't explicitly plan for. The trade-off is
  reliability and cost.

### Tools make the agent

The real power of an agent comes from combining simple tools in unexpected
ways. Take a basic set of datetime tools:

- `get_current_datetime` — gets the current date and time
- `add_duration_to_datetime` — adds time to a given date
- `set_reminder` — creates a reminder for a specific time

Individually simple, but Claude can chain them to handle much more complex
requests:

- "What's the time?" → just `get_current_datetime`.
- "What day of the week is it in 11 days?" → `get_current_datetime` then
  `add_duration_to_datetime`.
- "Remind me to go to the gym next Wednesday" → potentially all three tools
  in sequence.

Claude can also recognize when it's missing information — e.g. asked "When
does my 90-day warranty expire?", it knows to ask when the item was
purchased before it can calculate the expiration date.

### Tools should be abstract

Effective agents get reasonably abstract tools, not hyper-specialized ones.
Claude Code is the canonical example: it has generic, flexible tools —
`bash` (run any command), `read` (read any file), `write` (create any file),
`edit` (modify files), `glob` (find files), `grep` (search file contents) —
and notably does *not* have specialized tools like "refactor code," "run
tests," "create migration," or "install dependencies." Claude figures out
how to compose the generic tools to accomplish these tasks instead, which
lets it handle countless scenarios the developers never explicitly planned
for.

### Best practice: combinable tools

Design tool sets Claude can combine creatively. E.g. a social media video
agent might get:

- `bash` — access to FFMPEG for video processing
- `generate_image` — create images from prompts
- `text_to_speech` — convert text to audio
- `post_media` — upload content to social platforms

This supports both simple workflows (create and post a video) and more
interactive experiences — e.g. the agent generates a sample image first, gets
user approval, then proceeds with video creation. The agent can adapt its
approach based on user feedback, which is difficult to achieve with a rigid
workflow — this adaptability is what makes agents powerful for dynamic,
user-responsive applications.

## Environment Inspection

Claude operates blind by default — it needs a way to observe and understand
the results of its own actions to work effectively as an agent.

### Why it matters

With computer use, every action Claude takes (typing, clicking) is followed
by a screenshot so it can see what happened. This isn't optional: a click
could navigate to a new page, open a menu, or do something else entirely.
Without seeing the result, Claude has no way to know whether the action
succeeded or what the environment's new state looks like.

### Reading before writing

The same principle applies to file edits: before modifying a file, Claude
should read its current contents. E.g. asked to add a new route to a Python
file, Claude should first read the existing code to understand the current
structure — only then can it safely make the change without breaking
existing functionality.

### Guiding inspection via system prompts

For complex tasks, system prompt instructions can steer Claude toward
inspecting its own output. E.g. for a video generation agent with tools
`post_media`, `web_search`, `image_generator`, and `bash`, the system prompt
might say, after generating videos:

- Use the `bash` tool to run whisper.cpp and generate a caption file with
  timestamps — verify the dialogue was placed correctly.
- Use the `bash` tool to run FFmpeg and extract a screenshot from every
  second of the video — verify the video looks as expected.

### Benefits

- **Better progress tracking** — Claude can gauge how close it is to
  completing the task.
- **Error handling** — unexpected results can be detected and corrected.
- **Quality assurance** — output can be verified before the task is
  considered complete.
- **Adaptive behavior** — Claude can adjust its approach based on what it
  observes.

### Practical implementation

When designing an agent, always ask: "How will Claude know if this action
worked?" Provide tools and instructions that let it observe the results of
its actions, e.g.:

- Reading file contents before modifications.
- Taking screenshots after UI interactions.
- Checking API responses for expected data.
- Validating generated content against requirements.

Environment inspection is what turns Claude from a blind executor of
commands into an agent that can understand and adapt to its working
environment.

## Workflows vs. Agents — Summary

|             | Workflows                                                                                                          | Agents                                                                                                        |
| ----------- | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Summary     | A predefined series of calls to Claude meant to solve a known problem or set of problems. Used when you can picture the flow of steps ahead of time. | Claude is given a set of basic tools and is expected to formulate a plan to use them to complete a task.      |
| Benefits    | Claude can often focus on one subtask at a time, generally leading to higher accuracy. Far easier to evaluate and test, since you know each exact step. | Allows for a more flexible UX. Far more flexible task completion — Claude can combine tools in unexpected ways to complete a wide variety of tasks. |
| Downsides   | Far less flexible — dedicated to solving specific types of tasks. Generally more constrained UX — you need to know the exact inputs to the flow. | Lower successful task completion rate. More challenging to instrument, test, and evaluate.                    |

### When to use each

Users don't care whether you've built a fancy agent — they want a product
that works consistently. The general recommendation: **default to
workflows**, and only reach for agents when they're truly required.
Workflows give most production applications the reliability and
predictability they need; agents trade that reliability for flexibility in
scenarios where the exact requirements can't be predetermined.

Reach for a workflow when the process is well-defined; reach for an agent
when requests are unpredictable, varied, and need creative problem-solving.
