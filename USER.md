# Veritas Kanban User Guide

## What Veritas Kanban Is

Veritas Kanban is a local-first work board for people who build software with the help of AI agents.

It gives you one place to:

- organize work visually
- track what is waiting, active, blocked, or finished
- hand tasks to AI agents without losing visibility
- review what happened before you accept the result

If you want a board that feels like normal Kanban but is designed for agent-assisted delivery, this is what Veritas Kanban is for.

## Who Uses It

Veritas Kanban is most useful for:

- solo developers who want structure around AI-assisted coding
- technical leads coordinating several tasks across a repo or sprint
- teams experimenting with agent workflows but still wanting human review
- operators who need a simple way to see what agents are doing and when

## What Problem It Solves

Without a shared workflow, AI work gets messy fast. Tasks are spread across chats, terminal sessions, notes, and half-finished branches. It becomes hard to answer basic questions:

- What is being worked on right now?
- Which tasks are blocked?
- What did the agent actually change?
- Is this ready to close?

Veritas Kanban solves that by turning agent work into a visible, trackable process instead of a collection of disconnected prompts.

## What You Can Do With It

From a user perspective, the main value is straightforward:

- create projects and tasks that represent real work
- move work through a clear lifecycle
- assign tasks to yourself, teammates, or AI agents
- see active work and time spent
- review outputs before marking work complete
- keep a record of progress, decisions, and handoffs

## First Practical Workflow

This is the simplest way to use Veritas Kanban in practice:

1. Start the board and open it in your browser.
2. Create a project for the repo, client, or initiative you care about.
3. Add a task with a clear outcome, not just a vague idea.
4. Move the task to **In Progress** when work starts.
5. Do the work yourself or hand it to an AI agent.
6. Review the result, notes, and any code changes.
7. Mark the task **Done** only when the outcome is actually usable.

That basic loop is enough for day-to-day operation.

## How People Commonly Use It

### 1. Personal build queue

Use Veritas Kanban as your own delivery board.

Example:

- capture features, bugs, and follow-ups as tasks
- work top to bottom
- let an agent handle the repetitive parts
- keep final review and approval for yourself

This works well when you want focus and a visible backlog without extra process.

### 2. AI pair-programming workflow

Use the board to coordinate tasks you want an agent to tackle.

Example:

- create a task such as "add CSV export to reporting page"
- attach enough context for the agent to succeed
- start the task
- let the agent implement or research
- inspect the result before accepting it

This is useful when you want AI to help, but you do not want the work to disappear into chat history.

### 3. Multi-agent coordination

Use Veritas Kanban when several agents or contributors are active at the same time.

Example:

- one task for implementation
- one task for testing
- one task for documentation
- one task for review or release prep

The board gives you a shared picture of progress instead of making you reconstruct it from multiple tools.

### 4. Sprint or client delivery tracking

Use projects and tasks to represent real commitments.

Example:

- create a project for a sprint, product area, or client account
- keep the current queue visible
- use task movement to run standups or status checks
- close work with a short summary of what was delivered

This helps when stakeholders need a current view of work without reading raw technical detail.

## What Good Tasks Look Like

The best results come from tasks that are specific and outcome-based.

Good:

- "Fix duplicate notifications when a task is reassigned"
- "Add onboarding copy for first-time users"
- "Document the release checklist for weekly deploys"

Weak:

- "look into notifications"
- "work on onboarding"
- "improve docs"

If the task is clear, both humans and agents do better work.

## Key Features From a User Perspective

- **Visual board**: see work at a glance
- **Task lifecycle**: keep work moving instead of losing track of half-finished items
- **Agent support**: assign tasks to AI workflows without inventing a separate process
- **Comments and updates**: keep context attached to the task itself
- **Time tracking**: understand where effort is going
- **Review-friendly workflow**: finish with a decision, not just an output

## A Simple Daily Routine

Many users can operate Veritas Kanban with a lightweight routine:

1. Open the board and scan what is blocked or still active.
2. Pick the next highest-value task.
3. Clarify the task so the outcome is obvious.
4. Start work or hand it to an agent.
5. Check progress during the day instead of managing from memory.
6. Review, close, and record what was delivered.

## When Veritas Kanban Is a Good Fit

Veritas Kanban is a strong fit when:

- you want AI agents to work within a visible process
- you need better handoffs between humans and agents
- you prefer local-first tools over heavyweight cloud workflow systems
- you want task tracking tied closely to real software delivery work

## Where To Go Next

For setup and deeper walkthroughs, use the existing project docs:

- `README.md` for the main overview and quickstart
- `docs/GETTING-STARTED.md` for first-run setup
- `docs/WORKFLOW-GUIDE.md` for operating patterns
- `docs/TIPS-AND-TRICKS.md` for practical shortcuts

Use this file as the plain-language guide for what Veritas Kanban is for and how people actually use it.
