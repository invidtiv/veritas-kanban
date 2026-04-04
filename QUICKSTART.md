# Veritas Kanban - Quick Deployment Summary

## Current status

Verified on `2026-04-01`:

- Container: healthy
- Compose file: `docker-compose.prod.yml`
- Network mode: `host`
- Listen port: host `3001` over HTTP
- Local URL: `http://localhost:3001`
- Tailnet URL: `http://vmi2916953.tail652dda.ts.net:3001`

Important:

- `https://...:3001` is not configured.
- `https://babysharkstech.site/kanban` is not the active Veritas route on this host right now; it currently falls through to the BShome SPA.

## Access the board

From this server:

```bash
xdg-open http://localhost:3001
```

From another trusted Tailscale device:

```text
http://vmi2916953.tail652dda.ts.net:3001
```

First-time setup:

1. Open the board.
2. Log in with the Veritas password.
3. Use the API key only for scripts and agent tooling.

## API access

Host-local:

```bash
curl -H "Authorization: Bearer YOUR_ADMIN_KEY" \
  http://localhost:3001/api/v1/tasks
```

Over Tailscale:

```bash
curl -X POST http://vmi2916953.tail652dda.ts.net:3001/api/v1/tasks \
  -H "Authorization: Bearer YOUR_ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"title": "New Task", "status": "todo"}'
```

## Management commands

```bash
docker logs -f veritas-kanban
docker compose -f docker-compose.prod.yml restart
docker compose -f docker-compose.prod.yml down
```

Update and rebuild:

```bash
cd /home/bsdev/veritas-kanban
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

## Health checks

```bash
docker inspect veritas-kanban --format='{{.State.Health.Status}}'
curl http://localhost:3001/health
curl http://vmi2916953.tail652dda.ts.net:3001/health
```

## Security notes

- `VERITAS_ADMIN_KEY` must stay set and private.
- `VERITAS_JWT_SECRET` should be set so sessions survive restarts.
- `ALLOW_HTTP_AUTH=true` is required for browser login over Tailscale HTTP.
- `CORS_ORIGINS` must include the exact Tailscale origin used by browsers.

## Documentation

- [Full Deployment Guide](DEPLOYMENT.md)
- [NPM Reference Config](NPM-CONFIG.md)
- [Veritas Kanban README](README.md)
- [Server Inventory](/home/bsdev/AGENTS.md)

## OpenClaw integration

Use one of these:

```yaml
api_url: http://localhost:3001/api/v1
admin_key: ${VERITAS_ADMIN_KEY}
```

```yaml
api_url: http://vmi2916953.tail652dda.ts.net:3001/api/v1
admin_key: ${VERITAS_ADMIN_KEY}
```
