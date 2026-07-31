# Remote Coding-Agent Bootstrap

This runbook connects Linux and Windows coding stations to the live Veritas Kanban board through Tailscale. The board serves the VK CLI binaries, agent skill, platform installers, and an agent-readable setup document itself.

## Live Tailscale endpoints

- Board: `http://100.115.155.120:3001`
- Tailnet DNS: `http://vmi2916953.tail652dda.ts.net:3001`
- Installer page: `http://100.115.155.120:3001/remote-agent/`
- Agent instructions: `http://100.115.155.120:3001/llms.txt`
- Canonical API: `http://100.115.155.120:3001/api/v1`

Port `3001` is HTTP. Do not change it to HTTPS: Tailscale encrypts and authenticates the network path. Do not publish the installer or board through a public proxy.

## Operator: create a station identity

1. Sign in to the board.
2. Open **Settings → Security → Remote agent credentials**.
3. Create a stable ID such as `linux-coder-01` or `windows-build-02`.
4. Copy the one-time key and transfer it to the target station through a private channel.
5. Dismiss the key after the remote installation succeeds.

Each station must use a distinct identity. Remote stations use the `agent` role, never `VERITAS_ADMIN_KEY`. The server stores only a SHA-256 hash of each random 256-bit key in `.veritas-kanban/agent-credentials.json`; plaintext is returned only when a key is created or rotated.

The Security page can rotate, re-enable, or revoke an identity. Rotation invalidates the old key immediately. Creation, rotation, and revocation are written to the tamper-evident audit log.

## Remote: verify Tailscale

Linux:

```bash
tailscale status
curl -fsS http://100.115.155.120:3001/health
```

Windows PowerShell:

```powershell
tailscale status
Invoke-RestMethod http://100.115.155.120:3001/health
```

If MagicDNS is unavailable, keep using the IP address. A failure at both addresses means the station is not connected or is not authorized by the tailnet ACL.

## Install Linux x86-64

Run as the same OS user that launches the coding agent:

```bash
curl -fsSLo /tmp/install-vk.sh http://100.115.155.120:3001/remote-agent/install.sh
chmod +x /tmp/install-vk.sh
/tmp/install-vk.sh --agent-id 'linux-coder-01'
```

Paste the one-time key into the silent prompt.

The installer:

- downloads the standalone `vk` binary to `~/.local/bin/vk`;
- adds `~/.local/bin` to the login-shell PATH when needed;
- installs the skill in both `~/.codex/skills/veritas-kanban` and `~/.agents/skills/veritas-kanban`;
- verifies the standalone binary against the board's `SHA256SUMS` file;
- saves the scoped connection in `~/.config/veritas-kanban/config.json` with mode `0600`;
- runs an authenticated summary smoke test against the requested URL.

## Install Windows x86-64

Run in PowerShell as the same Windows user that launches the coding agent:

```powershell
$installer = "$env:TEMP\install-vk.ps1"
Invoke-RestMethod http://100.115.155.120:3001/remote-agent/install.ps1 -OutFile $installer
& $installer -AgentId 'windows-build-02'
```

Paste the one-time key into the PowerShell secure prompt.

The installer:

- downloads `vk.exe` to `%USERPROFILE%\.local\bin`;
- persists that directory in the user PATH;
- installs the skill in `%USERPROFILE%\.codex\skills` and `%USERPROFILE%\.agents\skills`;
- verifies the standalone binary against the board's `SHA256SUMS` file;
- stores the scoped VK connection under `%APPDATA%\veritas-kanban` and restricts its ACL;
- runs an authenticated summary smoke test.

Open a new terminal if the newly persisted PATH is not visible in the current shell.

## Agent-led setup

Give the remote coding agent this URL:

```text
http://100.115.155.120:3001/llms.txt
```

It tells the agent how to verify Tailscale, format a new-access request, install on either OS, configure an existing CLI, validate the connection, protect its key, and track all non-trivial work. The agent requests the key from an operator; it cannot mint its own credentials.

## Required smoke test

Run in a fresh shell without injecting an admin key:

```bash
vk status
vk summary
vk project list
```

Expected:

- server is `http://100.115.155.120:3001` or the documented tailnet DNS name;
- health is reachable;
- API key is configured;
- summary and project data return without `401` or `403`.

## Minimal tracked workflow

```bash
vk create "Task title" --type code --priority medium --project PROJECT_NAME --description "Objective and acceptance criteria"
vk begin TASK_ID
vk comment TASK_ID "Progress: meaningful milestone"
vk done TASK_ID "Verified completion summary"
```

Do not complete a task before required tests, commits, pushes, deployments, and runtime checks.

## Troubleshooting

### `401 Authentication required`

The key is missing, copied incorrectly, revoked, or belongs to another board. Confirm `vk status`, then ask an operator to rotate the station identity. Never fall back to the admin key.

### TLS or `wrong version number`

Use `http://...:3001`, not HTTPS.

### `fetch failed`

Confirm `tailscale status`, then test `/health` by IP. Verify no inherited `VK_API_URL` overrides the saved connection.

### `vk: command not found`

Open a new login shell or add `~/.local/bin` / `%USERPROFILE%\.local\bin` to PATH.

### Reinstall without a key

Both installers can install the CLI and skill before a credential is ready. Omit `VK_API_KEY`, then follow `llms.txt` to configure the existing installation later.

## Deployment and backup notes

The production Docker build creates portable glibc Linux and Windows x86-64 standalone binaries and copies them into `/app/remote-agent/bin`. Express serves `/remote-agent/` and `/llms.txt` before API authentication; these assets contain no credentials. Credential management remains admin-only under `/api/v1/agent-credentials`.

Back up `.veritas-kanban/agent-credentials.json` with the rest of the runtime state. Losing it revokes all managed remote keys; restoring an older copy can revive old keys, so rotate credentials after a rollback or uncertain restore.
