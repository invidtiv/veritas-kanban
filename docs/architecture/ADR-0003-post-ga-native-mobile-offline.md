# ADR 0003: Post-GA Native Mobile Offline Architecture

## Status

Accepted for post-GA planning.

Date: 2026-06-04

Issue: [#543](https://github.com/BradGroux/veritas-kanban/issues/543)

## Decision

Native iOS and Android apps will be post-GA companions to a trusted Veritas
host. They will not replace the v5.0 responsive web/PWA mobile path, and they
will not run a full Veritas server, agent runtime, workflow engine, Git
workspace, or desktop bridge on the device.

The native apps will use the Veritas server as the authority for identity,
permissions, task state, workflow state, work products, audit history, and sync.
Offline support will be implemented as an encrypted local read cache plus a
durable queue of constrained, mobile-safe operations. Queued operations are
tentative until the server accepts them after reconnect. The mobile client must
surface pending, synced, rejected, and conflicted states explicitly.

The preferred implementation path is a shared product model and API contract
from the existing TypeScript workspace, with thin native shells for iOS and
Android. The first implementation may use React Native or native platform UI,
but the architecture requires platform-backed secure storage, push handling,
background sync controls, and testable native permissions. The choice of UI
framework is an implementation issue; this ADR defines the authority, offline,
conflict, and security contract.

## Context

v5.0 GA supports mobile through responsive web and installable PWA surfaces.
Those surfaces deliberately cache only the static shell and do not queue API
writes while offline. That is the correct GA boundary because Veritas can
trigger workflows, agents, approvals, and work-product changes that have
security and provenance implications.

Native mobile can add value after GA if it supports field work, review,
approvals, notifications, and light task updates when connectivity is poor.
That value must not create a second source of truth or an unaudited path for
agent execution.

## Goals

- Give users a reliable mobile companion for board review, triage, comments,
  approvals, notifications, and lightweight task edits.
- Support offline reading from an encrypted cache.
- Support offline drafting and queuing for clearly mobile-safe writes.
- Keep the Veritas server authoritative for state, RBAC, workflow execution,
  policy checks, audit, and work-product storage.
- Make conflict semantics explicit before implementation.
- Define secure pairing, token storage, push notification, revocation, and
  remote access boundaries.
- Preserve a clean path for future hosted sync without assuming hosted SaaS in
  the GA desktop or PWA runtime.

## Non-Goals

- Shipping native mobile in v5.0 GA.
- Running the Veritas API server, workflow engine, agent runtime, OpenClaw,
  Codex, Git operations, or MCP server on mobile devices.
- Offline execution of workflow runs or agent jobs.
- Unrestricted offline mutation of admin, integration, credential, or
  workspace settings.
- Last-write-wins conflict resolution.
- Storing raw bearer tokens, recovery keys, webhook secrets, work-product
  secrets, or private attachment content in unencrypted mobile storage.

## Native Mobile Runtime Shape

```text
iOS or Android app
  - native shell, navigation, push registration, background sync hints
  - encrypted local store for cached records and queued operations
  - platform secure storage for device session credentials
  - sync engine with idempotency keys, base revisions, and conflict records
  - no local workflow engine, agent runtime, Git runner, shell, or desktop bridge

Trusted Veritas host
  - auth, pairing, RBAC, device sessions, revocation
  - API, WebSocket, workflow engine, task state, audit, work products
  - sync acceptance, conflict detection, policy enforcement, push fan-out
```

The mobile app may keep enough local metadata to render the board, inbox,
notifications, assigned approvals, selected work-product summaries, and recent
activity. The local store is a cache and queue, not an authoritative database.

## Client Modes And Capability Classes

Every action exposed to native mobile must be classified before implementation.

| Class          | Mobile offline                                               | Mobile online                                                | Examples                                                                                                                                                      |
| -------------- | ------------------------------------------------------------ | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mobile-safe    | Queue allowed when the action is deterministic and low risk. | Allowed through normal API and RBAC.                         | Draft task, edit title/description, add comment, assign self, change due date, mark notification read, draft approval response.                               |
| Remote-safe    | Not queued unless explicitly promoted to mobile-safe.        | Allowed online from trusted remote sessions with RBAC.       | Start a workflow dry run, view run evidence, request review, download a permitted work product.                                                               |
| Desktop-only   | Never available on mobile.                                   | Never available on mobile.                                   | Local data path selection, keychain migration, desktop update checks, local backup/import filesystem actions, native menus, deep links, local server restart. |
| Admin-only     | Never queued offline.                                        | Allowed only online with admin or owner role and fresh auth. | Invite users, revoke devices, rotate tokens, change auth settings, configure webhooks, configure remote exposure.                                             |
| Execution-only | Never queued offline.                                        | Allowed only when online and policy gates pass.              | Start or stop agent runs, execute workflow steps, trigger Git or shell work, approve dangerous automation.                                                    |

If an action cannot be classified cleanly, it defaults to online-only and
server-authoritative.

## Offline Read Semantics

When offline, native mobile may render cached data with a visible offline or
stale label. Cached records must include the server revision, fetched timestamp,
origin label, workspace id, actor id, and data class.

Allowed offline reads:

- Board columns, cards, assigned tasks, comments, and lightweight activity.
- Notification inbox and unread state.
- Workflow run summaries, current approval prompts, and evidence summaries.
- Work-product metadata and explicitly cached previews.
- User's own profile, workspace label, role summary, and device status.

Restricted offline reads:

- Attachment bodies and work-product content are cached only when explicitly
  opened or pinned by the user and permitted by policy.
- Sensitive work products, credentials, raw logs, debug bundles, and export
  packages are not cached unless a future policy defines encrypted retention,
  wipe behavior, and support-bundle redaction.
- Admin settings and device/token lists should show last-known summaries only
  and must require online refresh before mutation.

## Offline Write And Queue Semantics

Offline writes are stored as operation records, not as direct local database
updates. Each operation must include:

- `operationId` generated by the device.
- `deviceSessionId`.
- `workspaceId`.
- `actorId`.
- target entity id and type.
- base server revision or vector marker.
- operation type and normalized payload.
- created timestamp and local ordering key.
- idempotency key.
- visible local status: pending, synced, rejected, or conflicted.

The mobile UI may optimistically render queued operations, but it must mark them
as pending. A queued operation becomes durable only after the server accepts it
and returns the accepted revision.

Offline queue limits:

- Queue only mobile-safe operations.
- Require recent successful auth before allowing offline mutation. If the
  device has not connected within the configured freshness window, switch to
  read-only offline.
- Stop queueing when local encrypted storage is full, device integrity checks
  fail, the device session is revoked, or the workspace policy disables offline
  writes.
- Do not queue destructive actions, admin actions, credential changes,
  integration changes, agent runs, workflow execution, Git operations, backup,
  import, export, or server lifecycle actions.

## Conflict Semantics

The server resolves queued operations against current authoritative state. The
mobile client must never silently apply last-write-wins.

Conflict rules:

1. The server accepts an operation only if the actor still has permission and
   the operation's base revision is compatible with the current entity.
2. Idempotency keys make retries safe after reconnect.
3. Append-only operations such as comments and notification-read markers may
   merge automatically when permission and target existence still hold.
4. Field edits may merge automatically only when no accepted server change
   touched the same field after the queued base revision.
5. Status, assignee, priority, due date, workflow step, approval, and work
   product state changes conflict when the current server value differs from
   the queued base value.
6. Approval decisions drafted offline are not effective until accepted online.
   If the workflow step advanced, was revoked, or changed reviewer/policy, the
   draft becomes conflicted or rejected.
7. Deleted, archived, moved, permission-lost, or policy-denied targets reject or
   conflict instead of recreating hidden state.
8. Conflicted operations become explicit conflict records with ours, theirs,
   base, reason, and allowed next actions.

Conflict resolution may happen on mobile for simple field conflicts. Complex
workflow, work-product, Git, or admin conflicts should deep-link to the desktop
or web surface.

## Sync Protocol Requirements

The native sync client must validate the remote host using the same
trusted-host contract as ADR 0002:

- One HTTPS origin for app, API, WebSocket, health, auth, and sync.
- Auth enabled and localhost bypass disabled.
- WebSocket origin validation and authenticated subscriptions.
- Visible origin label in mobile diagnostics.
- Split-origin support only when explicitly configured and tested.

Sync must use server-issued revisions and idempotency. Polling, push wakeups,
and WebSocket reconnects may all trigger sync, but server acceptance remains
the only state transition from pending to synced.

Minimum sync endpoints or contracts:

- Bootstrap: server version, workspace id, actor context, role, feature flags,
  offline policy, data-retention policy, and sync cursor.
- Pull: changed records since cursor by workspace and data class.
- Push: ordered operation batch with idempotency and base revisions.
- Conflict: list and resolve conflict records.
- Device status: session health, revocation, push registration, last sync.

## Security Review

### Mobile Storage

- Store device session credentials only in Keychain on iOS and Android Keystore
  or equivalent hardware-backed secure storage where available.
- Store cached data and queued operations in an encrypted local database.
- Bind local cache to workspace id, device session id, and origin.
- Keep raw recovery keys, webhook secrets, admin keys, JWT signing secrets,
  integration credentials, and private keys out of mobile storage.
- Redact local diagnostics by default. Support bundles must not include cached
  task bodies, comments, attachments, work-product content, tokens, cookies, or
  local database files unless the user explicitly selects them and policy allows
  it.

### Tokens And Sessions

- Pair mobile devices through short-lived, single-use pairing codes or QR codes.
- Exchange pairing material for a scoped device session. Do not store pairing
  codes after exchange.
- Use refresh/session material scoped to device, workspace, actor, and
  permissions.
- Rotate mobile session material on server policy, user sign-out, suspicious
  sync behavior, or device re-pairing.
- Revocation must stop API access, WebSocket sync, push fan-out, and offline
  queue upload. The app should wipe or lock cached data after revocation is
  observed.

### Pairing

Pairing must show:

- normalized origin with no query string or fragment.
- workspace and actor being paired.
- device name and platform.
- permissions granted.
- offline-write policy.
- expiration.

Pairing must not embed long-lived credentials in URLs, QR codes, screenshots,
logs, push payloads, or copied diagnostics.

### Push Notifications

- APNs and FCM payloads carry opaque notification ids and coarse categories,
  not task bodies, comments, work-product content, tokens, or secrets.
- Push may wake the app to pull from the trusted Veritas host, subject to
  platform limits.
- Lost or revoked devices must stop receiving push as part of device-session
  revocation.
- Push registration tokens are credentials and must be stored, logged, and
  redacted accordingly.

### Remote Access

- Native mobile supports trusted HTTPS, LAN/VPN, reverse proxy, or tunnel
  origins that pass ADR 0002 validation.
- Public HTTP is unsupported for mobile sessions.
- Mobile diagnostics must label local, LAN/VPN, reverse-proxy, tunnel,
  split-origin, stale, and unknown modes without printing secrets.
- Native mobile does not receive desktop bridge powers even when connected to a
  desktop-supervised server.

## Work Products, Approvals, And Workflow Runs

Work products:

- Cache metadata by default.
- Cache content only after explicit open/pin and only when the content class is
  allowed for mobile storage.
- Upload new mobile attachments only online for the first implementation unless
  a future issue defines encrypted offline blob staging and size limits.

Approvals:

- Users may draft approval responses offline.
- Approval responses are not effective until accepted by the server.
- Changed workflow step, reviewer, policy, or evidence creates a conflict or
  rejection.

Workflow runs:

- Native mobile may view run summaries, evidence summaries, logs redacted by
  policy, and approval prompts.
- Native mobile may request online run actions only when RBAC and policy allow.
- Native mobile must not execute workflow steps, agent commands, shell commands,
  Git actions, OpenClaw/Codex work, or MCP writes locally.

## Implementation Phases

1. Define sync data classes, operation schemas, conflict payloads, and mobile
   policy flags in shared types.
2. Add server sync endpoints for bootstrap, pull, push, conflict listing, and
   device status.
3. Add mobile pairing and device-session revocation flows.
4. Build native shell, encrypted cache, secure credential storage, and read-only
   sync.
5. Enable mobile-safe offline queue for comments, lightweight task edits,
   notification read state, and drafted approvals.
6. Add push wakeups with opaque payloads.
7. Add conflict review UI and desktop/web handoff for complex conflicts.
8. Run mobile threat-model review, offline sync fixtures, revocation tests, and
   device-loss drills before beta.

## Required Test Evidence Before Native Mobile Beta

- Unit tests for operation normalization, idempotency, mergeability, and conflict
  classification.
- Server tests for permission changes between queue and replay.
- Device-session revocation tests that block queued uploads.
- Encrypted storage tests or platform smoke evidence for iOS and Android.
- Offline-to-online sync tests for accepted, rejected, and conflicted
  operations.
- Push payload redaction tests.
- Remote origin validation tests against trusted-host, tunnel, and rejected
  public HTTP scenarios.
- Manual device-loss drill documenting revoke, push stop, and local cache lock
  or wipe behavior.

## Consequences

- Native mobile can support useful offline work without making the device a
  second authority.
- Conflict work must be designed before broad offline writes ship.
- The server needs explicit sync and conflict APIs rather than ad hoc mobile
  patches to existing endpoints.
- Workflow and agent execution stay online, audited, and policy-gated.
- Hosted cloud sync can later reuse the same sync contracts, but this ADR does
  not assume a hosted SaaS default for desktop or PWA GA.
