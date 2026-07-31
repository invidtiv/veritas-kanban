# VK CLI reference

## Connection

```bash
vk status
vk connect http://100.115.155.120:3001 --key "$VK_API_KEY" --name AGENT_ID
vk disconnect
```

The preferred installer configures the connection. Avoid putting literal keys in shell history.

## Tasks

```bash
vk list
vk list --status in-progress
vk list --project PROJECT_NAME --type code
vk show TASK_ID
vk update TASK_ID --priority high
vk comment TASK_ID "Progress: ..."
vk block TASK_ID "Blocker: ..."
vk unblock TASK_ID
vk done TASK_ID "Completion summary"
```

## Time and identity

```bash
vk time start TASK_ID
vk time stop TASK_ID
vk time show TASK_ID
vk agent status
vk agent working TASK_ID
vk agent idle
```

## Projects and summaries

```bash
vk project list
vk summary
vk summary standup
```

## JSON automation

Most commands accept `--json`:

```bash
vk list --status in-progress --json
vk show TASK_ID --json
```

Parse the returned JSON instead of scraping colored terminal output.

## Troubleshooting

- `fetch failed`: confirm Tailscale is connected and `vk status` points to `http://100.115.155.120:3001`.
- TLS or `wrong version number`: use HTTP, not HTTPS, on port 3001.
- `401`: the credential is missing, revoked, or from another VK instance. Request a new scoped agent credential from an administrator.
- `403`: the credential is read-only or the action requires admin access. Do not work around the role boundary.
- `vk: command not found`: re-run the platform installer from `http://100.115.155.120:3001/remote-agent/` and open a new shell.
