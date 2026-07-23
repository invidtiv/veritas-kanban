# Web To Mac Desktop Migration

This guide moves an existing file-backed Veritas Kanban web/source install into
the packaged macOS desktop app.

Use it when a board currently lives in a checkout such as
`~/Projects/veritas-kanban` with file-backed data under `tasks/` and
`.veritas-kanban/`, and the operator wants the signed Mac app installed by
Homebrew or the GitHub release ZIP to become the owner of `localhost:3001`.

The Homebrew cask installs the app. It does not automatically import a previous
source checkout's board data, stop a development server, disable old watchdogs,
or migrate automation tokens.

## What Changes

Before migration:

- the old web/source install may serve `localhost:3001` from `server/src`
  through `tsx`, `pnpm dev`, `npm run dev`, or a local watchdog
- the source of truth is usually file-backed data in the repo root:
  `tasks/` plus `.veritas-kanban/`
- local automation may assume unauthenticated localhost writes

After migration:

- `/Applications/Veritas Kanban.app` supervises the bundled local server
- packaged mode uses SQLite storage
- desktop data lives under the macOS Application Support workspace
- packaged mode keeps auth enabled, including for localhost write APIs
- old file-backed source data remains available as rollback/source history

Default desktop workspace:

```text
~/Library/Application Support/@veritas-kanban/desktop/profiles/default/workspaces/local/
```

Default desktop SQLite database:

```text
~/Library/Application Support/@veritas-kanban/desktop/profiles/default/workspaces/local/data/.veritas-kanban/veritas.db
```

## Preconditions

1. Install the Mac app:

   ```bash
   brew tap BradGroux/tap
   brew install --cask veritas-kanban
   ```

2. Confirm the old board source root. For a source checkout, this is usually:

   ```bash
   cd ~/Projects/veritas-kanban
   test -d tasks
   test -d .veritas-kanban
   ```

3. Confirm which process currently owns port `3001`:

   ```bash
   lsof -nP -iTCP:3001 -sTCP:LISTEN
   ps -o pid,ppid,pgid,command -p "$(lsof -tiTCP:3001 -sTCP:LISTEN)"
   ```

   If the command path points at `~/Projects/veritas-kanban`, the old source
   checkout is still serving the board.

4. Choose an auth method for API-driven migration:

   - Preferred: create or use a scoped admin/operator API token from the
     desktop UI and export it only for the migration shell.
   - Acceptable for local break-glass: use the packaged desktop owner/admin
     key only for the migration session, then clear the shell history or close
     the terminal.

   Never paste API keys into issue descriptions, task bodies, debug bundles, or
   support notes.

## Step 1: Preserve The Old Source

Create a recoverable copy before any import attempt:

```bash
SOURCE_ROOT="$HOME/Projects/veritas-kanban"
BACKUP_ROOT="$HOME/Library/Application Support/@veritas-kanban/manual-migration-backups/pre-desktop-$(date +%Y%m%d-%H%M%S)"

mkdir -p "$BACKUP_ROOT"
ditto "$SOURCE_ROOT/tasks" "$BACKUP_ROOT/tasks"
ditto "$SOURCE_ROOT/.veritas-kanban" "$BACKUP_ROOT/.veritas-kanban"
```

Do not delete or move the source checkout yet. The file-backed data remains the
rollback source of truth until the desktop SQLite board is accepted.

## Step 2: Stop Competing Source Servers

Only one process should own active VK writes during migration. Stop the old
source server before the desktop app becomes authoritative.

Common source-dev processes:

```bash
ps aux | rg 'Projects/veritas-kanban|pnpm dev|npm run dev|tsx.*src/index|vite'
```

Gracefully stop the process group for the source dev server. If a watcher or
supervisor owns it, stop the supervisor too.

If a user LaunchAgent was created for a local dev watchdog, inspect it before
disabling:

```bash
launchctl print "gui/$(id -u)" | rg -i 'veritas|kanban|watchdog' -C 2
rg -n 'dev-watchdog|veritas-kanban' ~/Library/LaunchAgents
```

Disable only the old source checkout watchdog:

```bash
launchctl bootout "gui/$(id -u)" \
  "$HOME/Library/LaunchAgents/io.digitalmeld.veritas-kanban.watchdog.plist" 2>/dev/null || true

launchctl disable "gui/$(id -u)/io.digitalmeld.veritas-kanban.watchdog" 2>/dev/null || true
```

Do not disable unrelated production supervisors or remote deployments.

## Step 3: Launch The Mac App

Start the packaged app:

```bash
open -a "Veritas Kanban"
```

Wait for the bundled server to bind `127.0.0.1:3001`:

```bash
for i in {1..30}; do
  if lsof -nP -iTCP:3001 -sTCP:LISTEN >/dev/null 2>&1; then
    lsof -nP -iTCP:3001 -sTCP:LISTEN
    break
  fi
  sleep 1
done
```

The expected command path is:

```text
/Applications/Veritas Kanban.app/Contents/MacOS/veritas-kanban
/Applications/Veritas Kanban.app/Contents/Resources/server/dist/index.js
```

Health should be available without credentials:

```bash
curl -fsS http://127.0.0.1:3001/api/health
```

Write/read APIs require an API key in packaged mode:

```bash
export VK_API_KEY="paste-a-local-admin-or-scoped-migration-token-here"
curl -fsS -H "X-API-Key: $VK_API_KEY" http://127.0.0.1:3001/api/auth/status
```

## Step 4: Back Up The Desktop Target

Back up the desktop SQLite target before import:

```bash
DESKTOP_ROOT="$HOME/Library/Application Support/@veritas-kanban/desktop/profiles/default/workspaces/local"
TARGET_DB="$DESKTOP_ROOT/data/.veritas-kanban/veritas.db"
TARGET_BACKUP="$DESKTOP_ROOT/backups/pre-import-$(date +%Y%m%d-%H%M%S)"

mkdir -p "$TARGET_BACKUP"
cp "$TARGET_DB" "$TARGET_BACKUP/veritas.db" 2>/dev/null || true
cp "$TARGET_DB-wal" "$TARGET_BACKUP/veritas.db-wal" 2>/dev/null || true
cp "$TARGET_DB-shm" "$TARGET_BACKUP/veritas.db-shm" 2>/dev/null || true
```

If the app has never created a database, the `cp` commands may have nothing to
copy. Keep the backup directory anyway as the migration audit marker.

## Step 5: Dry Run The File-To-SQLite Migration

Run the migration dry run against the desktop server:

```bash
SOURCE_ROOT="$HOME/Projects/veritas-kanban"
DESKTOP_ROOT="$HOME/Library/Application Support/@veritas-kanban/desktop/profiles/default/workspaces/local"
TARGET_DB="$DESKTOP_ROOT/data/.veritas-kanban/veritas.db"
JOURNAL="$DESKTOP_ROOT/config/file-to-sqlite-migration-journal.json"

curl -fsS -X POST http://127.0.0.1:3001/api/v1/sqlite/migration/dry-run \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $VK_API_KEY" \
  -d "{
    \"sourceRoot\": \"$SOURCE_ROOT\",
    \"sqlitePath\": \"$TARGET_DB\",
    \"journalPath\": \"$JOURNAL\"
  }" | jq .
```

Review the report before importing. Warnings that usually do not block a
desktop cutover:

- missing old attachment files, if the task metadata can still load
- duplicate archived task IDs, if the report shows deterministic skips and the
  active task set is complete
- malformed legacy optional records that are reported as skipped, not fatal

Warnings that should stop the migration:

- active task parse failures
- unreadable `tasks/` or `.veritas-kanban/`
- backup copy failures for required source folders
- inability to open or promote the SQLite target

## Step 6: Run The Import

After the dry run is acceptable:

```bash
IMPORT_BACKUP="$DESKTOP_ROOT/backups/file-storage-pre-sqlite-import"

curl -fsS -X POST http://127.0.0.1:3001/api/v1/sqlite/migration/run \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $VK_API_KEY" \
  -d "{
    \"sourceRoot\": \"$SOURCE_ROOT\",
    \"sqlitePath\": \"$TARGET_DB\",
    \"backupDir\": \"$IMPORT_BACKUP\",
    \"journalPath\": \"$JOURNAL\"
  }" | jq .
```

Preserve:

- the import response
- `file-to-sqlite-migration-journal.json`
- `file-storage-pre-sqlite-import/`
- the pre-import desktop DB backup
- the old source checkout

## Step 7: Verify The Desktop SQLite Board

Confirm the packaged app still owns `3001`:

```bash
lsof -nP -iTCP:3001 -sTCP:LISTEN
ps -o pid,ppid,pgid,command -p "$(lsof -tiTCP:3001 -sTCP:LISTEN)"
```

Confirm health and representative data:

```bash
curl -fsS http://127.0.0.1:3001/api/health

curl -fsS -H "X-API-Key: $VK_API_KEY" \
  "http://127.0.0.1:3001/api/tasks?limit=1" | jq .
```

Optional direct SQLite count checks:

```bash
sqlite3 "$TARGET_DB" "
select 'tasks', count(*) from tasks
union all select 'squad_messages', count(*) from squad_messages
union all select 'telemetry_events', count(*) from telemetry_events
union all select 'workflow_definitions', count(*) from workflow_definitions
union all select 'workflow_runs', count(*) from workflow_runs;
"
```

Smoke these surfaces before accepting the migration:

- board loads
- task detail opens
- search returns migrated tasks
- workflows list loads
- squad chat history loads
- telemetry/analytics pages load
- Settings -> Maintenance reports healthy storage
- local automation can authenticate with `VK_API_KEY`

## Step 8: Update Local Automation

Packaged desktop mode keeps auth enabled. Scripts, agents, MCP servers, and
cron jobs that previously wrote to unauthenticated localhost must send an API
key:

```bash
export VK_API_URL="http://127.0.0.1:3001"
export VK_API_KEY="paste-scoped-token-here"
```

For long-lived automation, create a scoped token in VK and store it in the
operator's normal secret manager. Do not hard-code owner/admin keys into repo
scripts.

Heartbeat or service recovery should reopen the app:

```bash
open -a "Veritas Kanban"
```

It should not restart `~/Projects/veritas-kanban` unless the operator
explicitly wants development mode.

## Rollback

Rollback before acceptance:

1. Quit the Mac app.
2. Restore the desktop DB from the pre-import desktop backup, or move the
   migrated desktop workspace aside.
3. Re-enable and start the old source server only if the operator chooses to
   keep using the source checkout.
4. Boot the source checkout with file storage.
5. Verify board, task detail, search, workflows, chat, and settings.

API restore from a pre-migration source backup is documented in
[`MIGRATION-RECOVERY.md`](MIGRATION-RECOVERY.md). Do not treat SQLite down
migrations as the rollback path for GA users.

## Troubleshooting

### Homebrew app opens but old board appears

Check who owns `3001`. If it is a `node`, `tsx`, `vite`, or `pnpm dev` command
from `~/Projects/veritas-kanban`, the Homebrew app is not the active API owner.
Stop the old process and relaunch the Mac app.

### Homebrew app opens but APIs return `AUTH_REQUIRED`

This is expected in packaged mode. Use the desktop UI session for browser work
or send `X-API-Key` / `Authorization: Bearer` for API automation.

### The old server comes back after being killed

Look for LaunchAgents, tmux sessions, shells, or process supervisors that start
`scripts/dev-watchdog.sh`, `pnpm dev`, or `server/src/index.ts`. Disable only
the stale source-checkout watchdog.

### The app does not bind `3001`

Open the desktop logs:

```bash
tail -200 "$HOME/Library/Application Support/@veritas-kanban/desktop/profiles/default/workspaces/local/logs/server.log"
```

Common causes:

- another process already owns `3001`
- desktop secrets are corrupt; see `desktop/README.md` recovery notes
- SQLite target is on an unsafe or unsupported filesystem
- the packaged server exited before startup completed

### Counts are lower than expected

Compare the dry-run report, import report, and direct SQLite counts. Check for
warnings about duplicate task IDs, skipped malformed records, and missing
attachments. Do not delete the old file-backed source until the migrated board
is accepted.
