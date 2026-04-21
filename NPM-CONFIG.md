# nginx-proxy-manager Reference Config for Veritas Kanban

## Status on this host

This file is reference material, not the current live access path on `bsdev`.

Verified on `2026-04-01`:

- Live Veritas access is direct over Tailscale at `http://vmi2916953.tail652dda.ts.net:3001`
- `https://babysharkstech.site/kanban` currently falls through to the BShome SPA instead of Veritas Kanban
- `docker-compose.prod.yml` uses `network_mode: host`, so the Veritas container is not attached to `nginx-proxy-manager_npm-network`

That means the older `Forward Hostname/IP: veritas-kanban` instructions below do not match the current deployment unless Veritas is moved back to bridge networking.

## Historical `/kanban` proxy recipe

Use this only if you restore Veritas to the shared NPM Docker network and verify the route end-to-end.

### 1. Access NPM Admin UI

Navigate to `http://localhost:81` or `https://babysharkstech.site:81`.

### 2. Add Custom Location to babysharkstech.site

1. Go to **Hosts** -> **Proxy Hosts**
2. Click **babysharkstech.site**
3. Open **Custom Locations**
4. Add a location for `/kanban`

### 3. Historical bridge-network settings

These settings assume Veritas is reachable from NPM as `veritas-kanban:3001`.

- **Location**: `/kanban`
- **Scheme**: `http`
- **Forward Hostname / IP**: `veritas-kanban`
- **Forward Port**: `3001`

Advanced config:

```nginx
rewrite ^/kanban/?(.*)$ /$1 break;

auth_request /_bshome_auth;
error_page 401 =302 /login?next=$request_uri;

proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_set_header X-Forwarded-Host $host;
proxy_set_header X-Original-URI $request_uri;

proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";

proxy_read_timeout 60s;
proxy_connect_timeout 60s;
proxy_send_timeout 60s;
```

### 4. bshome forward-auth block

Server-level NPM config:

```nginx
location = /_bshome_auth {
  internal;
  proxy_pass http://bshome:3001/api/auth/verify;
  proxy_pass_request_body off;
  proxy_set_header Content-Length "";
  proxy_set_header Cookie $http_cookie;
  proxy_set_header Host $host;
  proxy_set_header X-Original-URI $request_uri;
  proxy_set_header X-Forwarded-Proto $scheme;
  proxy_set_header X-Forwarded-Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

## If you want `/kanban` back on bsdev

Choose one deployment model first:

1. **Bridge-network model**
   Move Veritas off `network_mode: host`, attach it to `nginx-proxy-manager_npm-network`, and then use the historical container-name proxy recipe above.
2. **Host-network model**
   Keep Veritas on host networking and proxy NPM to a host-reachable address on port `3001`. Document the exact target used when this is implemented.

Do not keep docs claiming both models at once.

## Current direct-access checks

These are the live checks that currently matter:

```bash
curl http://localhost:3001/health
curl http://vmi2916953.tail652dda.ts.net:3001/health
```

Expected failure:

```bash
curl -k https://vmi2916953.tail652dda.ts.net:3001/health
```

## Troubleshooting

### `/kanban` shows BShome instead of Veritas

That is the current state on `2026-04-01`. Treat this file as historical/reference-only until the route is restored.

### Direct Tailscale access works but browser login fails

- Verify `ALLOW_HTTP_AUTH=true`
- Verify `VERITAS_JWT_SECRET` is set
- Verify `CORS_ORIGINS` includes the Tailscale hostname and IP

## References

- [Veritas Deployment Guide](DEPLOYMENT.md)
- [Quick Deployment Summary](QUICKSTART.md)
- [Main Server Inventory](/home/bsdev/AGENTS.md)
