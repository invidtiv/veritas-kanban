# AGENTS.md - Agent Workflow Guide

## Kanban Integration (MANDATORY)

All work MUST be tracked on the Veritas Kanban board using the `vk` CLI.

### Board Access

- **Host local URL**: http://localhost:3001
- **Tailnet URL**: http://vmi2916953.tail652dda.ts.net:3001
- **Note**: HTTPS is not configured on port `3001`; do not use `https://...:3001`.
- **Remote bootstrap runbook**: `REMOTE-AGENT-BOOTSTRAP.md`
- **CLI**: `vk` command (install: `npm install -g veritas-kanban-cli`)

### Before Starting

1. Create a task:

   ```bash
   vk create "Task title" -t code -p PROJECT_NAME
   ```

2. Begin work (moves to in-progress and starts timer):
   ```bash
   vk begin <task-id>
   ```

### During Work

- Add progress comments:
  ```bash
  vk comment <task-id> "Progress update"
  ```
- Update task details:
  ```bash
  vk update <task-id> --description "Updated scope"
  ```

### After Commit/Push

1. Complete the task (stops timer, adds summary):
   ```bash
   vk done <task-id> "What was accomplished and key insights"
   ```

### Additional Commands

- List all tasks: `vk list`
- Show task details: `vk show <task-id>`
- Archive completed tasks: `vk archive <task-id>`
- View help: `vk --help`

## Project: veritas-kanban
