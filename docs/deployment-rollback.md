# Deployment and rollback

Deploy only remote branch `feat/tier0-rag` at SHA `674bf51ea19a10ca50b7b3fcfb63650f5e96ee4a`. Preserve the existing Nginx site, TLS configuration, PostgreSQL database, and unrelated PM2 processes.

```bash
git fetch origin
git checkout 674bf51ea19a10ca50b7b3fcfb63650f5e96ee4a
npm ci
npm run check
node scripts/ingest-rag.js
pm2 reload agrisense --update-env
curl -fsS http://127.0.0.1:3001/api/health
curl -fsS https://<existing-host>/api/health
```

Verify the session endpoint, reload the saved session, inspect citations/trace in a browser, then compare `/api/health.deploymentSha` with `674bf51ea19a10ca50b7b3fcfb63650f5e96ee4a`.

Rollback target before this change: `73ccf3ce57b5ddd2b34ad11cd08722295a697ee7`.

```bash
git checkout 73ccf3ce57b5ddd2b34ad11cd08722295a697ee7
npm ci && npm run build
pm2 reload agrisense --update-env
```

Migration 002 is additive. Leave `rag_chunks` and `rag_ingestions` in place during application rollback; the old revision ignores them. Do not drop tables during an incident.
