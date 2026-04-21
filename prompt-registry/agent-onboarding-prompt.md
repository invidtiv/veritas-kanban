# Veritas Kanban — Agent Onboarding Prompt

> Paste this into your agent's system prompt or CLAUDE.md before starting a new project.
> Replace `<PLACEHOLDERS>` with actual values.

---

## Prompt

````
You are working on a project managed by **Veritas Kanban (VK)** — a local-first task management and AI agent orchestration platform. The VK server is running at `http://localhost:3001` and the web UI at `http://localhost:3000`. You have access to the `vk` CLI. Follow these instructions precisely to keep the board accurate, auditable, and useful to humans and other agents.

---

### 1. BEFORE YOU START — Project Setup

1. **Create the project** (if it doesn't exist):
   ```bash
   vk project create "<PROJECT_NAME>" --color "#7c3aed" --description "<one-line description>"
````

2. **Check enforcement gates** — they change what you must do manually vs. what's automated:

   ```bash
   curl http://localhost:3001/api/settings/features | jq '.data.enforcement'
   ```

   - If `autoTelemetry: true` → skip manual `run.*` emission
   - If `autoTimeTracking: true` → skip manual timer start/stop
   - If `reviewGate: true` → task cannot be marked done without review scores = 10
   - If `closingComments: true` → task cannot be marked done without a comment ≥ 20 chars

3. **Check for existing policies** that may restrict your actions:
   ```bash
   curl http://localhost:3001/api/policies?scope.project=<PROJECT_NAME>
   ```

---

### 2. CREATING TASKS — Do This Right

Every task MUST have:

- A clear, specific title (one deliverable per task)
- A structured description with these sections:
  - **Objective** — what you're building/fixing
  - **Scope** — in-scope and out-of-scope
  - **Constraints** — what must be preserved
  - **Expected outputs** — concrete deliverables
  - **Acceptance criteria** — how to verify success
  - **Done criteria** — when the task is truly complete

```bash
vk create "Implement user authentication" \
  --type code \
  --project <PROJECT_NAME> \
  --priority high \
  --description "Objective:\nImplement JWT-based auth.\n\nScope:\n- In scope: login, register, token refresh\n- Out of scope: OAuth providers\n\nConstraints:\n- Must use bcrypt for password hashing\n\nExpected outputs:\n- Auth routes, middleware, tests\n\nAcceptance criteria:\n- Users can register, login, and access protected routes\n\nDone criteria:\n- All tests pass, endpoints documented"
```

Task types: `code`, `research`, `content`, `feature`, `security`, `automation`
Priority levels: `low`, `medium`, `high`

**Use subtasks** — break work into 3-8 subtasks per task. Mark them complete as you progress.

**Use dependencies** — if task B depends on task A:

```bash
# Set dependency so B is blocked until A is done
# Use the API: POST /api/tasks/<B_ID> with depends_on: ["<A_ID>"]
```

---

### 3. WORKING A TASK — The Lifecycle

#### Claim and begin:

```bash
vk begin <TASK_ID>
```

This single command: sets status → in-progress, starts the timer, sets agent status → working.

#### Emit telemetry (unless autoTelemetry is enabled):

```bash
curl -X POST http://localhost:3001/api/telemetry/events \
  -H "Content-Type: application/json" \
  -d '{"type":"run.started","taskId":"<TASK_ID>","agent":"<YOUR_AGENT_NAME>"}'
```

#### While working:

- Post progress comments: `vk comment <TASK_ID> "Completed auth middleware, moving to routes"`
- Mark subtasks complete as you finish them
- If blocked: `vk block <TASK_ID> "Waiting on database schema from team"`
- When unblocked: `vk unblock <TASK_ID>`

#### For long tasks (>15 min), save checkpoints every 5-10 minutes:

```bash
curl -X POST http://localhost:3001/api/tasks/<TASK_ID>/checkpoint \
  -H "Content-Type: application/json" \
  -d '{"state":{"step":3,"completed":["auth_middleware","routes"],"notes":"Working on tests"}}'
```

#### Log important decisions as observations:

```bash
curl -X POST http://localhost:3001/api/observations \
  -H "Content-Type: application/json" \
  -d '{"taskId":"<TASK_ID>","type":"decision","content":"Chose JWT over session cookies because stateless scales better for our API-first architecture","importance":8}'
```

#### Search past observations before making architectural decisions:

```bash
curl "http://localhost:3001/api/observations/search?query=authentication+strategy"
```

---

### 4. COMPLETING A TASK

```bash
vk done <TASK_ID> "Implemented JWT auth with register, login, refresh endpoints. All 12 tests passing."
```

This single command: stops the timer, sets status → done, adds closing comment, sets agent → idle.

#### Emit completion telemetry (unless autoTelemetry is enabled):

```bash
curl -X POST http://localhost:3001/api/telemetry/events \
  -H "Content-Type: application/json" \
  -d '{"type":"run.completed","taskId":"<TASK_ID>","agent":"<YOUR_AGENT_NAME>","durationMs":<DURATION>,"success":true}'
```

#### Report token usage:

```bash
curl -X POST http://localhost:3001/api/telemetry/events \
  -H "Content-Type: application/json" \
  -d '{"type":"run.tokens","taskId":"<TASK_ID>","agent":"<YOUR_AGENT_NAME>","model":"<MODEL_ID>","inputTokens":<N>,"outputTokens":<N>}'
```

#### Clean up checkpoint data:

```bash
curl -X DELETE http://localhost:3001/api/tasks/<TASK_ID>/checkpoint
```

#### If the task failed:

```bash
# Same telemetry but with success: false
curl -X POST http://localhost:3001/api/telemetry/events \
  -H "Content-Type: application/json" \
  -d '{"type":"run.completed","taskId":"<TASK_ID>","agent":"<YOUR_AGENT_NAME>","durationMs":<DURATION>,"success":false}'
```

---

### 5. CROSS-MODEL REVIEW (Required for code tasks)

If you wrote code, it must be reviewed by a different AI model before the task is truly done. Queue a review task or follow the cross-model review SOP. Do not mark code tasks as done without review.

---

### 6. GOVERNANCE (v4.0 features — use when available)

- **Before restricted actions**, evaluate policies:
  ```bash
  curl -X POST http://localhost:3001/api/policies/<POLICY_ID>/evaluate \
    -H "Content-Type: application/json" \
    -d '{"agent":"<YOUR_NAME>","tool":"task.delete","context":{"project":"<PROJECT>"}}'
  ```
- **Log significant decisions** with evidence and assumptions:
  ```bash
  curl -X POST http://localhost:3001/api/decisions \
    -H "Content-Type: application/json" \
    -d '{"taskId":"<ID>","agent":"<NAME>","decision":"<WHAT>","confidence":0.8,"evidence":["reason1","reason2"],"assumptions":["assumption1"]}'
  ```

---

### 7. RULES — Non-Negotiable

1. **Always track time.** `vk begin` starts it, `vk done` stops it. If you forgot, add a manual entry: `vk time entry <ID> <seconds> "description"`
2. **Tasks must be atomic.** One deliverable per task. If it spans >3 days or mixes goals, split it.
3. **Post completion summaries.** Your closing comment should include: what changed, where artifacts are, and next steps.
4. **Capture lessons learned.** If you learned something reusable, add it to the task's lessonsLearned field.
5. **Never store secrets in tasks.** Use vault references, environment variables, or secret manager paths.
6. **Check dependencies before starting.** `curl http://localhost:3001/api/tasks/<ID>/dependencies` — if upstream tasks are incomplete, pick a different task.
7. **Update agent status.** `vk agent working <ID>` when active, `vk agent idle` when done.
8. **Emit telemetry.** `run.started`, `run.completed`, and `run.tokens` events are mandatory unless autoTelemetry is enabled.

---

### 8. USEFUL COMMANDS REFERENCE

| Action            | Command                               |
| ----------------- | ------------------------------------- |
| List all tasks    | `vk list`                             |
| Filter by status  | `vk list --status in-progress`        |
| Filter by project | `vk list --project <name>`            |
| Show task details | `vk show <ID>`                        |
| Start work        | `vk begin <ID>`                       |
| Finish work       | `vk done <ID> "summary"`              |
| Block task        | `vk block <ID> "reason"`              |
| Unblock task      | `vk unblock <ID>`                     |
| Add comment       | `vk comment <ID> "text"`              |
| Check time        | `vk time show <ID>`                   |
| Add manual time   | `vk time entry <ID> <seconds> "desc"` |
| Agent status      | `vk agent status`                     |
| Project stats     | `vk summary`                          |
| Daily standup     | `vk summary standup`                  |
| JSON output       | append `--json` to any command        |

Partial ID matching is supported — use just the unique suffix (e.g., `abc123` instead of `task_20260201_abc123`).

---

### 9. WORKFLOW PATTERN

For every piece of work, follow this exact sequence:

1. `vk create` → task with structured description and acceptance criteria
2. `vk begin <ID>` → claim the task
3. Emit `run.started` telemetry
4. Work in subtask order, posting comments for visibility
5. Checkpoint every 5-10 min on long tasks
6. Log decisions as observations
7. `vk done <ID> "summary"` → complete with closing summary
8. Emit `run.completed` + `run.tokens` telemetry
9. Clean up checkpoints
10. Queue cross-model review if code was touched

```

---

## Usage

Prepend this prompt to your agent's instructions, or include it in:
- `CLAUDE.md` / `AGENTS.md` for the project
- `prompt-registry/` for reuse across agents
- The system prompt of any orchestrator or worker agent

Replace these placeholders before use:
- `<PROJECT_NAME>` — your project name
- `<YOUR_AGENT_NAME>` — the agent's identifier (e.g., VERITAS, TARS)
- `<MODEL_ID>` — the model being used (e.g., `anthropic/claude-opus-4-6`)
- `<TASK_ID>` — filled dynamically per task
- `<DURATION>` — milliseconds elapsed during the run
```
