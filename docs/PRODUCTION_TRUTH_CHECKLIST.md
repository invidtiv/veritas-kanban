# Production Truth Checklist (Veritas + VOS)

Status: ACTIVE
Owner: SETH
Date: 2026-02-27

## Goal

Ensure Mission Control reflects real execution state (no UI-only truth, no manual patch drift).

## Step 1 — Runtime hygiene (single path)

- [ ] Run `pnpm dev:clean`
- [ ] Confirm only Veritas server (3001) + web (3000) are active
- [ ] Confirm `/api/health` returns OK

## Step 2 — Agent registry contract

- [ ] Enforce register-on-start for orchestration agents
- [ ] Enforce heartbeat while busy (2-3 min)
- [ ] Enforce idle clear on completion (`currentTaskId=null`)
- [ ] Verify offline timeout behavior (5 min)

## Step 3 — Squad event truth channel

- [ ] Wire `agent.spawned`, `agent.status`, `agent.completed`, `agent.failed`
- [ ] Ensure events map to task/agent transitions
- [ ] Verify events visible in UI timeline/squad feed

## Step 4 — Realtime + fallback consistency

- [ ] WebSocket updates active
- [ ] `/api/changes` ETag polling fallback active
- [ ] Add freshness indicator + last-updated timestamp in UI
- [ ] Ensure stale feed never masks registry busy state

## Step 5 — Reconciliation rules (authoritative)

- [ ] Define source precedence (task transition vs heartbeat vs squad event)
- [ ] Prevent status flapping
- [ ] Auto-correct contradictions (e.g., in-progress task + no active agent)

## Step 6 — Verification gates (must pass)

- [ ] Scenario A: in-progress task => at least one busy agent
- [ ] Scenario B: done/blocked task => agent returns idle
- [ ] Scenario C: websocket interruption => fallback keeps truth
- [ ] Scenario D: stale/offline agent displayed correctly with timestamp

## Step 7 — Artifacts

- [ ] Commit changes
- [ ] Update docs: troubleshooting + architecture note
- [ ] Post final pass/fail report in #mission-control and #ops-log
