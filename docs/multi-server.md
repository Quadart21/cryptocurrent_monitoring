# Multi-server GapSnap (DB · worker · web)

Same git repo on **web** and **worker**. Shared PostgreSQL on a third host (or managed DB).

## Roles

| Host | `GAPSNAP_ROLE` | Listens | Notes |
|------|----------------|---------|--------|
| DB | — | `5432` private | `pg_hba` allow web+worker only |
| Worker | `worker` | `3001` private | Pollers; `/api/internal/worker` |
| Web | `web` | `3000` + Nginx public | No pollers; proxies heavy sync |

Monolith fallback: `GAPSNAP_ROLE=all` (default).

## Shared secrets

```env
DATABASE_URL=postgresql://gapsnap:PASS@DB_PRIVATE_IP:5432/gapsnap
SESSION_SECRET=...
ADMIN_LOGIN=...
ADMIN_PASSWORD=...
WORKER_INTERNAL_SECRET=long-random-shared
```

### Web only

```env
GAPSNAP_ROLE=web
WORKER_URL=http://WORKER_PRIVATE_IP:3001
SITE_URL=https://YOUR_DOMAIN
```

### Worker only

```env
GAPSNAP_ROLE=worker
PORT=3001
GAPSNAP_RUN_MIGRATIONS=0
# Proxy pool / FEED_* / CODEX_* live here
```

## Boot

```bash
# both hosts
git pull && npm install && npm run build

# web
pm2 start ecosystem.config.cjs --only gapsnap-web
pm2 save

# worker
pm2 start ecosystem.config.cjs --only gapsnap-worker
pm2 save
```

## Checks

```bash
curl -s https://YOUR_DOMAIN/api/health
# {"ok":true,"role":"web","pollers":false}

curl -s -H "x-gapsnap-worker-secret: SECRET" http://WORKER:3001/api/internal/worker
# {"ok":true,"role":"worker",...}
```

Firewall: worker **must not** be on 0.0.0.0/public without restrict; prefer private VPC + allow from web IP only.
