# ADR 0004: Post-GA Cloud Sync And Hosted SaaS Model

## Status

Accepted for post-GA planning.

Date: 2026-06-04

Issue: [#544](https://github.com/BradGroux/veritas-kanban/issues/544)

## Decision

Veritas Kanban remains local-first and self-hostable by default. v5 Mac GA,
responsive web, PWA, CLI, MCP, and desktop runtime must not assume a hosted
account, hosted endpoint, cloud billing state, managed identity provider, or
cloud sync service.

Post-GA hosted work will be scoped as an optional managed Veritas workspace
service. The first hosted phase should behave like a managed trusted Veritas
host with tenant-isolated data, backup/export guarantees, clear billing
boundaries, auditable support access, and explicit migration paths to and from
local desktop or self-hosted deployments. It should not start as hidden
peer-to-peer sync, silent desktop upload, or a hosted-only rewrite of the
product.

The hosted data plane must preserve the same authority model as ADR 0002 and
ADR 0003: the trusted Veritas host is authoritative for workspace state,
identity, device sessions, workflow state, audit, and sync acceptance. Local
desktop, PWA, native mobile, CLI, MCP, and agents connect to that host using the
same authenticated API and WebSocket contracts. Offline clients may cache and
queue only according to the mobile/offline policies defined in ADR 0003.

## Product Position

The product line has three supported post-GA deployment choices:

| Choice               | Owner of runtime and data                 | Intended user                                            | Product promise                                                                 |
| -------------------- | ----------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Local desktop        | User's machine                            | Individual local-first users and builders                | No account required, no hosted dependency, exportable data.                     |
| Self-hosted server   | Customer/operator                         | Teams that want LAN, VPN, reverse proxy, or private host | Open-source, customer-controlled operations, documented backup/restore.         |
| Hosted Veritas Cloud | Digital Meld managed service, opt-in only | Teams that want managed sync, backups, and collaboration | Managed availability, tenant isolation, export/delete guarantees, paid support. |

Hosted Veritas Cloud is optional. It must not become a prerequisite for local
desktop use, self-hosting, PWA install, native mobile pairing, CLI setup, MCP
setup, or agent workflows.

## Non-Goals

- Shipping hosted sync or hosted SaaS in v5 Mac GA.
- Adding cloud account prompts to first-run desktop setup.
- Enabling telemetry, billing calls, or hosted discovery by default.
- Silently uploading a local SQLite database, task content, attachments, work
  products, prompts, logs, or support bundles.
- Making hosted state the only supported source of truth.
- Building a multi-tenant shared-database rewrite before a managed single-tenant
  or cell-based model is proven.
- Migrating raw local secrets, webhook secrets, admin keys, API token secrets,
  recovery keys, or device-session secrets into hosted import.

## Hosted Architecture Target

The first hosted phase should use a cell-based architecture:

```text
Control plane
  - organizations, tenant records, billing entitlements, support access grants
  - deployment inventory, health summaries, backup manifests, deletion jobs
  - no task bodies, comments, work-product bodies, attachments, or raw secrets

Tenant data plane cell
  - managed Veritas server runtime for one tenant or a small isolated tenant group
  - tenant-isolated database or volume
  - tenant-scoped object storage for attachments, backups, exports, and work products
  - tenant-scoped audit stream and retention policy
  - same-origin API, web app, WebSocket, health, and sync endpoints

Clients
  - desktop remote mode, browser/PWA, native mobile, CLI, MCP, and agents
  - authenticate to the tenant origin
  - receive no desktop-only local bridge powers from hosted mode
```

The first beta may use a managed single-tenant Veritas server with an isolated
database and storage volume per customer tenant. A shared multi-tenant data
plane is a later optimization and requires its own isolation proof, migration
plan, and load model.

## Tenant Isolation

Hosted state must be isolated by tenant before any beta:

- Separate tenant ids in every control-plane record.
- Separate tenant data plane database, schema, or database namespace.
- Separate object storage prefix or bucket per tenant.
- Tenant-scoped encryption key or key hierarchy for stored objects and backups.
- Tenant id in every audit, support, backup, restore, deletion, and billing
  event.
- No cross-tenant admin query path in normal application code.
- Automated tests that prove tenant A cannot read, export, restore, delete, or
  receive WebSocket events for tenant B.

Support tooling must use a separate audited control-plane path. Support access
cannot be implemented as a reusable owner/admin session.

## Auth, Workspace Ownership, And Device Pairing

Hosted identity extends the v5 identity model without changing local defaults.

Required hosted auth rules:

- Every hosted request uses an authenticated user, device, service, or agent
  principal.
- Localhost bypass is never available in hosted mode.
- Owner/admin roles remain workspace-scoped. A billing owner is not
  automatically a workspace owner unless explicitly granted.
- Device pairing uses short-lived, tenant-scoped pairing material and produces a
  revocable device session.
- Device revocation stops API access, WebSocket subscriptions, push fan-out, and
  queued mobile uploads.
- Service and agent tokens are scoped to tenant, workspace, route/action class,
  expiration, and actor identity.
- Support access is time-bound, reason-coded, tenant-scoped, and visible in the
  customer's audit log.

SSO and SCIM can be post-beta additions. They must not block the first hosted
sync proof if password/session auth and device pairing satisfy the security
review.

## Sync And Authority Model

Hosted sync is not peer-to-peer replication between arbitrary local SQLite
files. For the first hosted phase, the hosted tenant origin is the server
authority:

- Desktop local data can be exported and imported into hosted.
- Self-hosted data can be exported and imported into hosted.
- Hosted data can be exported back to self-hosted or local desktop.
- Once a workspace is hosted, clients connect to the hosted origin for writes.
- Local clients may keep caches, but they do not become competing authorities.
- Offline writes are accepted or rejected only by the hosted server after
  reconnect.

Continuous bidirectional sync between a local desktop-authoritative SQLite
database and a hosted-authoritative workspace is out of the first phase. It
requires a separate conflict model, backup model, and operator UX because two
authorities can diverge.

## Data Lifecycle, Retention, And Deletion

Hosted lifecycle must extend `docs/DATA-LIFECYCLE.md` with concrete retention
values before beta.

Initial hosted target:

| Data class                    | Default retention target                            | Delete/export behavior                                           |
| ----------------------------- | --------------------------------------------------- | ---------------------------------------------------------------- |
| Active workspace data         | Until customer deletes or exports/migrates away.    | Full tenant export available to owner/admin.                     |
| Attachments and work products | Follows workspace and object retention policy.      | Included in full export with manifest and hashes.                |
| Operational telemetry         | 30 days unless customer selects shorter retention.  | Aggregated for health/cost; redacted from support by default.    |
| Audit and governance records  | 1 year default, configurable upward for paid plans. | Included in owner/admin export; not silently removed by cleanup. |
| Backups                       | 35 days rolling default for hosted-managed backups. | Backup manifest visible; restore drill required.                 |
| Deleted workspace soft-delete | 30 days unless immediate purge is legally required. | Owner/admin can cancel restore window or request purge.          |
| Post-delete backup tombstones | Purged after the backup retention window expires.   | Deletion certificate records tenant id, counts, and timestamps.  |
| Support access logs           | 2 years default.                                    | Exportable audit evidence; never user-editable.                  |

Raw secrets are not included in customer exports. Device sessions, API token
secrets, pairing material, webhook secrets, recovery keys, push tokens, and
signing keys must be revoked or recreated after migration.

## Backup, Export, And Migration Guarantees

Hosted must keep data portable:

- Full tenant export uses a documented manifest with row counts, data classes,
  object hashes, schema version, app version, and redaction state.
- Workspace export must round-trip into a supported self-hosted or local desktop
  release when schema versions are compatible.
- Hosted import must accept a v5 backup/export only after dry-run validation.
- Import dry-run reports unsupported schema, missing objects, duplicate
  identities, token/session omissions, attachment hash mismatches, and policy
  differences.
- Customer-owned exports do not include raw hosted infrastructure metadata,
  billing data, support-only notes, or secret material.
- Migration never reuses local owner/admin tokens, API token secrets, device
  session secrets, webhook secrets, or push credentials.

Supported migration paths:

| Path                    | Mechanism                                                                     | Notes                                                                        |
| ----------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Local desktop to hosted | Desktop export, hosted import dry-run, hosted import, device re-pairing.      | Local app switches to remote hosted mode after acceptance.                   |
| Self-hosted to hosted   | Server export, hosted import dry-run, DNS/client cutover, token recreation.   | Operator verifies `/api`, `/ws`, auth, backup, and support settings.         |
| Hosted to self-hosted   | Hosted export, self-hosted import dry-run, restore/import, device re-pairing. | Billing cancellation does not destroy export rights during retention window. |
| Hosted to local desktop | Hosted export, local desktop restore/import, new local secrets.               | Hosted push/device sessions are revoked after cutover if requested.          |

## Security And Privacy Requirements

Hosted beta is blocked until the following are complete:

- Threat model for tenant isolation, support access, billing systems, object
  storage, backups, WebSocket fan-out, workflow runs, agents, and imports.
- Exact origin and WebSocket validation matching ADR 0002.
- HTTPS only for hosted browser, desktop remote, mobile, CLI, MCP, and agent
  clients.
- Strong session secrets, managed key rotation, and no secret values in logs.
- Rate limits for auth, sync, workflow, upload, export, and support endpoints.
- Audit events for login, pairing, token creation/revocation, support access,
  export, import, restore, deletion, billing ownership, and role changes.
- Redacted support bundles by default.
- Data processing posture documented in customer-facing privacy terms before
  paid launch.
- No customer content used for model training, demos, benchmarks, or support
  reproduction without explicit customer authorization.

## Billing And Cost Boundaries

Hosted cost must be modeled before beta. The product should avoid "unlimited"
plans until usage data proves margins.

Billable or quota-bearing units:

- Organization or tenant.
- Human seats by role.
- Storage GB for attachments, work products, backups, and exports.
- Monthly active workspaces.
- Workflow/agent run minutes or execution count.
- Push/notification volume.
- API and WebSocket usage at abuse thresholds.
- Backup retention beyond default.
- Support tier and audit retention tier.

Billing data lives in the control plane. Customer task content, comments, work
products, attachments, prompts, and raw logs do not live in billing records.

Cost dashboards must track:

- compute per tenant/cell.
- database and object storage per tenant.
- backup storage and restore tests.
- egress.
- workflow/agent execution time.
- support time.
- failed job retries and queue depth.

## Support Model

Hosted support must be designed before paid launch:

- Self-service health page for origin, API, WebSocket, sync, backup, and
  storage status.
- Customer-generated redacted support bundle.
- Time-bound support access grants with reason, approver, scope, expiry, and
  audit entry.
- Break-glass access only for incidents, with separate approval and customer
  notification policy.
- Incident runbooks for tenant outage, data restore, accidental deletion,
  compromised device/session, push leak, billing lockout, and cross-tenant
  access alert.
- Support must not ask customers to paste secrets, raw tokens, private keys,
  recovery keys, or unredacted database files into tickets.

## No Hosted Leakage Into v5 GA

The v5 Mac GA runtime and docs must keep these boundaries:

- No default hosted API URL.
- No cloud login requirement.
- No billing checks in local desktop startup.
- No automatic cloud discovery.
- No automatic telemetry upload.
- No hidden sync worker.
- No hosted feature flags that change local behavior by default.
- No hosted-only account language in first-run local setup.
- No migration prompt that implies local data should be uploaded.

Future hosted settings should stay disabled unless the operator or user
explicitly chooses a hosted origin, pairing flow, or import target.

## Required Proof Before Hosted Beta

- Tenant isolation tests across API, WebSocket, export, import, backup, restore,
  support, and deletion.
- Backup restore drill for at least one tenant cell.
- Hosted export to self-hosted import round trip.
- Self-hosted or local export to hosted import dry-run and import.
- Device revocation drill for browser, desktop remote, PWA, and native mobile.
- Support access audit drill.
- Deletion and purge drill with backup tombstone expiration.
- Cost model with expected margin at small, medium, and large tenant sizes.
- Privacy/security review approved before any customer data is processed.

## Consequences

- The local-first and self-hosted product stays credible because hosted is
  optional and portable.
- Hosted work is larger than "add sync" because tenant isolation, support,
  deletion, backups, billing, and cost controls are part of the product.
- A managed single-tenant or cell-based model is more expensive initially, but
  it reduces cross-tenant blast radius while the product validates demand.
- Continuous local-to-cloud bidirectional sync is deferred until the authority
  and conflict model can be designed safely.
- Native mobile offline work from ADR 0003 can reuse the hosted sync contracts
  without making hosted sync a v5 GA dependency.
