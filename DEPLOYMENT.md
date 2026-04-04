# Veritas Kanban - bsdev Deployment Guide

## Current deployment

This file describes the live deployment on `/home/bsdev` as verified on `2026-04-01`.

- **Service**: `veritas-kanban`
- **Compose file**: `docker-compose.prod.yml`
- **Network mode**: `host`
- **Listen port**: host `3001` over plain HTTP
- **Verified URLs**:
  - `http://localhost:3001`
  - `http://vmi2916953.tail652dda.ts.net:3001`
- **Auth**: Veritas password login or API key
- **Data**: `/home/bsdev/veritas-kanban/.veritas-kanban/` and `/home/bsdev/veritas-kanban/tasks/`

Important notes:

- `https://vmi2916953.tail652dda.ts.net:3001` is not configured. The app creates an HTTP server only.
- The Tailscale cert/key files mounted by `docker-compose.prod.yml` are currently unused by the app.
- `https://babysharkstech.site/kanban` is not the live access path on this host as of `2026-04-01`; requests currently fall through to the BShome SPA instead of Veritas Kanban.
- `ALLOW_HTTP_AUTH=true` is required so browser login cookies work over tailnet HTTP.

## Deploy or redeploy

```bash
cd /home/bsdev/veritas-kanban
docker compose -f docker-compose.prod.yml up -d --build
```

## Verify the deployment

```bash
docker ps | grep veritas-kanban
docker logs veritas-kanban --tail 100
ss -lntp | rg ':3001'
```

Health checks:

```bash
curl http://localhost:3001/health
curl http://vmi2916953.tail652dda.ts.net:3001/health
```

Expected failure:

```bash
curl -k https://vmi2916953.tail652dda.ts.net:3001/health
# Fails because port 3001 is HTTP only.
```

## Environment variables

Edit `/home/bsdev/veritas-kanban/.env` to configure:

- `VERITAS_ADMIN_KEY`: required API key for agents and scripts
- `VERITAS_JWT_SECRET`: strongly recommended so browser sessions survive restarts
- `PORT`: defaults to `3001`
- `CORS_ORIGINS`: must include the direct Tailscale origin(s) used by browsers
- `ALLOW_HTTP_AUTH=true`: required for HTTP cookie auth on the tailnet
- `BSHOME_AUTH_ME_URL`: optional legacy integration hook; it does not make `/kanban` the live route

Current live container env includes the Tailscale hostname and IP in `CORS_ORIGINS`.

## Access patterns

### Local access from this host

- UI: `http://localhost:3001`
- API: `http://localhost:3001/api/v1`

### Tailscale access from another trusted device

- UI: `http://vmi2916953.tail652dda.ts.net:3001`
- API: `http://vmi2916953.tail652dda.ts.net:3001/api/v1`

### Public `/kanban` route

The repo still contains `NPM-CONFIG.md` and other reverse-proxy notes, but they are reference material only right now. The current bsdev deployment is not serving Veritas Kanban at `https://babysharkstech.site/kanban`.

## API examples

```bash
curl -X POST http://localhost:3001/api/v1/tasks \
  -H "Authorization: Bearer YOUR_ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "New Task",
    "status": "todo",
    "priority": "medium"
  }'
```

Remote over Tailscale:

```bash
curl -X POST http://vmi2916953.tail652dda.ts.net:3001/api/v1/tasks \
  -H "Authorization: Bearer YOUR_ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "New Task",
    "status": "todo",
    "priority": "medium"
  }'
```

## Maintenance

```bash
docker logs -f veritas-kanban
docker compose -f docker-compose.prod.yml restart
```

Update:

```bash
cd /home/bsdev/veritas-kanban
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

Backup:

```bash
tar -czf veritas-kanban-backup-$(date +%Y%m%d).tar.gz .veritas-kanban tasks
```

## Troubleshooting

### UI loads on HTTP but HTTPS fails on `:3001`

That is expected with the current deployment. The service is HTTP only on port `3001`.

### Tailscale page loads but login does not persist

- Verify `ALLOW_HTTP_AUTH=true`
- Verify `VERITAS_JWT_SECRET` is set
- Verify the browser is using one of the origins listed in `CORS_ORIGINS`

### `https://babysharkstech.site/kanban` shows BShome instead of Veritas

That is the current behavior on `2026-04-01`. Treat the NPM docs as historical/reference-only until the reverse proxy is restored and re-verified.

## Integration with OpenClaw

Use the host-local API from this server:

```yaml
api_url: http://localhost:3001/api/v1
admin_key: ${VERITAS_ADMIN_KEY}
```

From another Tailscale device:

```yaml
api_url: http://vmi2916953.tail652dda.ts.net:3001/api/v1
admin_key: ${VERITAS_ADMIN_KEY}
```

## Related documentation

- [Quick Deployment Summary](QUICKSTART.md)
- [NPM Reference Config](NPM-CONFIG.md)
- [Veritas Kanban README](README.md)
- [Main AGENTS.md](/home/bsdev/AGENTS.md)
