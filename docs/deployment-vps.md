# AgriSense release runbook

## Production topology

- Host: a private VPS or managed host with HTTPS.
- Public origin: the configured application domain.
- Farmer application: `/` with API routes under `/api/`.
- Existing payment service: `/api/bdapps/` and protected console `/payments/`.
- Payment systemd unit: `agrisense-payment.service`, internal port `4317`.
- PostgreSQL: required for durable accounts, HttpOnly sessions, compact memory, and multi-session conversations.

## Required server-only environment

```text
NODE_ENV=production
PORT=3001
OPENAI_API_KEY=<server-secret>
OPENAI_MODEL=gpt-5.6
OPENAI_REALTIME_MODEL=gpt-realtime-2.1
OPENAI_REALTIME_VOICE=marin
OPENAI_SAFETY_SECRET=<server-only-random-value>
DATABASE_URL=<managed-database-url>
DATABASE_SSL_REJECT_UNAUTHORIZED=true
AUTH_SESSION_SECRET=<at least 32 cryptographically random characters>
PAYMENT_SERVICE_URL=http://127.0.0.1:4317/api/bdapps
PAYMENT_DASHBOARD_URL=https://your-domain.example/payments/
PAYMENT_ADMIN_TOKEN=<server-secret>
APP_REVISION=<git commit>
```

Never put these values in Git, a browser bundle, logs, screenshots, agent activity, or prompts. Reuse the existing payment-service `.env` only as a private server-side source for its operator token; do not replace its database or bdapps configuration.

## Release procedure

1. Create a versioned release directory under `/opt/agrisense/releases/<revision>`.
2. Copy the Git-tracked application files only. Exclude `.git`, `.env`, `node_modules`, `dist`, `tmp`, and local test artifacts.
3. Link or copy the protected production `.env` into the release.
4. Run `npm ci`, `npm test`, `npm run build`, and `npm audit --omit=dev` on the VPS.
5. Start once against PostgreSQL so `farm_sessions`, `auth_users`, and `auth_sessions` are created idempotently.
6. Switch `/opt/agrisense/current` to the verified release and restart the AgriSense service.
7. Keep `agrisense-payment.service` unchanged unless its own package is intentionally redeployed.
8. Verify HTTPS:
   - `GET /api/health`
   - `GET /api/payments/status`
   - landing page and language controls
   - OTP request only after explicit operator approval
   - OTP verification using the code delivered to the authorized test handset
   - dashboard, memory restore, market/image/voice fallbacks, logout
9. If any release gate fails, restore the previous `current` symlink and restart the prior service.

## Safety gates

- Do not perform a real CaaS direct debit during smoke verification.
- Do not automatically retry any payment with an unknown outcome.
- Do not request an OTP for a real number during an automated smoke test.
- Run any stress, evolution, patch, or re-evaluation loop only after the release has been handed to the operator.
