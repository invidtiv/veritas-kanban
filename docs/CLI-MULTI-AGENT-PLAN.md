# VK CLI Multi-Agent Collaboration Plan

Concrete implementation plan for making `vk` the primary coordination layer for sandbox and multi-agent workflows.

## Goal

Make agent-to-agent coordination viable from the terminal by making ownership, decomposition, dependencies, and full task state visible and operable without dropping into the web UI.

## Phase 1: Foundation

Status: implemented in this patch set

- Surface `createdBy` and assigned agent ownership directly in `vk list`
- Add server-backed filters for `--created-by`, `--assigned-to`, sprint, and active-task search
- Add richer `vk show` output
- Add `vk describe` / `vk inspect` as a full task dossier command
- Add explicit `vk assign`, `vk unassign`, and `vk claim` workflows
- Add CLI command groups for:
  - `vk subtask ...`
  - `vk verify ...`
  - `vk dependency ...`

## Phase 2: Collaboration Ergonomics

Status: next priority

- Add CLI comment inspection and edit/delete flows
- Add `vk activity <task-id>` and `vk audit <task-id>` views
- Add agent registry discovery commands:
  - list registered agents
  - filter by capability/status
  - distinguish eligible agents from currently idle agents
- Add bulk task operations from CLI for status and archive flows

## Phase 3: Stronger Orchestration

Status: planned

- Add explicit handoff semantics:
  - claim
  - release
  - handoff
  - acknowledge
- Add parent/child relationships between full tasks, beyond embedded subtasks
- Add saved searches / labels / tags
- Add optimistic concurrency or revision-aware updates for safer concurrent agent edits
- Add higher-level inbox/work queue commands such as:
  - `vk my-work`
  - `vk created-by me`
  - `vk ready`

## Rationale

The shared task model and server already contain most of the required collaboration state. The critical gap has been the CLI surface. These phases prioritize exposing and operationalizing existing collaboration data before introducing new backend complexity.
