---
name: veritas-kanban
description: Track coding-agent work on the shared Veritas Kanban board with the vk CLI. Use whenever starting, implementing, debugging, reviewing, documenting, deploying, or completing non-trivial work on a station connected to the BabySharks Tailscale network, and when asked to create, update, show, or complete VK tasks.
---

# Veritas Kanban

Use `vk` for all board access. Never call the board API directly and never print, commit, or include `VK_API_KEY` in task text, logs, or chat.

## Verify access

Run:

```bash
vk status
vk summary
```

If `vk` is missing or access fails, fetch `http://100.115.155.120:3001/llms.txt` and follow it. Do not substitute a public URL. Port `3001` uses HTTP inside Tailscale, not HTTPS.

If no scoped key exists, stop before board work and send this through an approved private channel:

```text
VK ACCESS REQUEST
agent_id: <stable-lowercase-station-and-agent-name>
station: <machine-hostname>
role: agent
purpose: <repository and work scope>
```

Wait for an operator to create the identity under **Settings → Security → Remote agent credentials**. Never borrow another station's key or request `VERITAS_ADMIN_KEY`.

## Track the work

For any non-trivial task:

```bash
TASK_ID=$(vk create "Concise task title" \
  --type code \
  --priority medium \
  --project PROJECT_NAME \
  --description "Objective: ...\n\nScope:\n- ...\n\nAcceptance criteria:\n- ..." \
  --json | jq -r '.id')
vk begin "$TASK_ID"
```

If `jq` is unavailable, create the task without `--json` and copy the returned ID. Use the project that owns the files being changed; inspect `vk project list` if uncertain.

Add comments only at useful milestones:

```bash
vk comment "$TASK_ID" "Progress: implemented the credential flow; validating installers"
vk block "$TASK_ID" "Blocker: concise reason"
vk unblock "$TASK_ID"
```

Complete only after requested verification and delivery are finished:

```bash
vk done "$TASK_ID" "Implemented the requested change, verified it, and delivered the scoped result."
```

Do not mark work done before required commits, pushes, deployments, or runtime checks.

## Preserve identity and secrets

- Treat the provisioned agent ID as the actor identity. Do not reuse another station's key.
- Use `VK_API_URL=http://100.115.155.120:3001` or the tailnet hostname documented in `llms.txt`.
- Keep the credential in the VK config store or `VK_API_KEY`; never use `VERITAS_ADMIN_KEY` on remote stations.
- Request rotation immediately if a key appears in terminal output, source control, task descriptions, or chat.
- Keep unrelated worktree changes untouched and stage only scoped files.

Read [references/cli.md](references/cli.md) when you need filtering, time tracking, project commands, machine-readable output, or troubleshooting.
