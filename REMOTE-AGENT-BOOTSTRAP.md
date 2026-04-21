# Remote Agent Bootstrap for Veritas Kanban

This runbook bootstraps a remote agent or remote workstation onto the live Veritas Kanban board running on `bsdev`.

## Current board endpoint

- UI: `http://vmi2916953.tail652dda.ts.net:3001`
- API base: `http://vmi2916953.tail652dda.ts.net:3001/api/v1`
- Fallback IP: `http://100.115.155.120:3001`

Important:

- Port `3001` is HTTP only. Do not use `https://...:3001`.
- Do not use `https://babysharkstech.site/kanban` for remote bootstrap. That route is not the live board path right now.

## What the remote needs

The remote machine or remote agent environment needs:

1. Tailscale connectivity to the `bsdev` tailnet
2. A Veritas API key
3. The `vk` CLI on `PATH`
4. Shell startup files that export the right Veritas environment variables

## Fast bootstrap

Run this on the remote machine as the user that will launch the agent:

```bash
# Install the CLI if needed
npm install -g veritas-kanban-cli

# Add this to ~/.profile
cat >> ~/.profile <<'EOF'
# Veritas Kanban remote bootstrap
export VK_API_URL="http://vmi2916953.tail652dda.ts.net:3001"
export VERITAS_ADMIN_KEY="REPLACE_WITH_REAL_KEY"
export VK_API_KEY="$VERITAS_ADMIN_KEY"

# If vk was installed via pnpm, keep PNPM_HOME on PATH.
export PNPM_HOME="$HOME/.local/share/pnpm"
case ":$PATH:" in
  *":$PNPM_HOME:"*) ;;
  *) export PATH="$PNPM_HOME:$PATH" ;;
esac
EOF

# Optional: also add the same block to ~/.bashrc for interactive shells
cat >> ~/.bashrc <<'EOF'
# Veritas Kanban remote bootstrap
export VK_API_URL="http://vmi2916953.tail652dda.ts.net:3001"
export VERITAS_ADMIN_KEY="REPLACE_WITH_REAL_KEY"
export VK_API_KEY="$VERITAS_ADMIN_KEY"
EOF

# Reload shell config
source ~/.profile
```

Replace `REPLACE_WITH_REAL_KEY` with the real Veritas API key before use.

## Why `.profile` matters

Many agent runners start shells with `bash -lc '...'`.

That means:

- `.bashrc` alone is not enough on many remotes
- `VK_API_URL` should be in `.profile`
- `VK_API_KEY` should be in `.profile`
- `PNPM_HOME` should be in `.profile` if the CLI is installed with pnpm

If you skip this, the common failure is:

```bash
Error: fetch failed
```

or:

```bash
vk: command not found
```

## Smoke tests

After bootstrap, run all of these on the remote:

```bash
printf 'VK_API_URL=%s\n' "$VK_API_URL"
command -v vk
curl -s "$VK_API_URL/health"
vk summary
vk project list
```

Expected:

- `VK_API_URL` prints the `http://vmi2916953.tail652dda.ts.net:3001` URL
- `vk` resolves to a binary path
- `/health` returns JSON
- `vk summary` returns board counts
- `vk project list` returns project labels

## Minimal agent workflow

Once bootstrapped, the remote agent can use the CLI directly:

```bash
# Create task
vk create "Task title" -t code -p veritas-kanban -d "What the agent will do"

# Start work
vk begin <task-id>

# Add progress note
vk comment <task-id> "Progress update"

# Finish work
vk done <task-id> "Summary of what changed"
```

Useful read commands:

```bash
vk list
vk list -p veritas-kanban
vk show <task-id>
vk summary
vk project list
```

## Non-interactive validation

If the remote uses wrappers, cron, systemd, SSH commands, or any launcher that does not inherit your current shell, validate with a clean login shell:

```bash
env -i HOME="$HOME" USER="$USER" SHELL=/bin/bash PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin \
  bash -lc 'printf "VK_API_URL=%s\n" "$VK_API_URL"; command -v vk; vk summary'
```

If this works, the remote bootstrap is correct for agent runners too.

## Common failures

### `fetch failed`

Usually caused by one of these:

- `VK_API_URL` still points to `https://localhost:3001`
- `VK_API_URL` uses `https://...:3001` instead of `http://...:3001`
- the remote is not on Tailscale

Check:

```bash
printf 'VK_API_URL=%s\n' "$VK_API_URL"
curl -v "$VK_API_URL/health"
```

### `wrong version number` or TLS errors

You are using HTTPS against a plain-HTTP port.

Fix:

```bash
export VK_API_URL="http://vmi2916953.tail652dda.ts.net:3001"
```

### `vk: command not found`

Either:

- the CLI is not installed
- it was installed with pnpm and `PNPM_HOME` is missing from `PATH`

Fix:

```bash
npm install -g veritas-kanban-cli
```

or ensure:

```bash
export PNPM_HOME="$HOME/.local/share/pnpm"
export PATH="$PNPM_HOME:$PATH"
```

### `401 Authentication required`

The remote shell does not have the right API key.

Check:

```bash
printf 'VK_API_KEY=%s\n' "${VK_API_KEY:+SET}"
```

Then re-export the correct key in `.profile`.

### Tailscale hostname does not resolve

Use the current Tailscale IP directly:

```bash
export VK_API_URL="http://100.115.155.120:3001"
```

Then fix the remote's Tailscale/DNS state later.

## Recommended handoff package for another agent

When handing this to another remote agent or operator, provide exactly:

1. This document
2. The board URL
3. The API key through a secure channel
4. The target project name to use with `vk create -p ...`
5. One smoke-test command they must paste back after setup

Suggested smoke-test reply:

```bash
vk summary && vk project list
```

## bsdev reference

The current `bsdev` host itself was fixed to use the same pattern:

- `VK_API_URL=http://localhost:3001`
- exports live in both `~/.bashrc` and `~/.profile`
- `PNPM_HOME` is present for login shells

Mirror that model on remotes unless you have a better machine-specific bootstrap system.
