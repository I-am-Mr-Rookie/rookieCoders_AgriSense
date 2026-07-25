# Koushik payment integration handoff

This package contains the production AgriSense bdapps payment service, dashboard, PostgreSQL schema, deployment configuration, and the active server `.env` requested for the handoff.

## Security warning

The included `.env` contains live bdapps, database, and operator credentials.

- Transfer this ZIP privately.
- Do not upload it to GitHub, Drive links with public access, chat groups, or issue trackers.
- Never import `.env` into React or expose `BDAPPS_PASSWORD`, `DATABASE_URL`, or `PAYMENT_ADMIN_TOKEN` to browser code.
- Rotate the credentials after the handoff if the ZIP is copied to an uncontrolled device.

## Recommended integration architecture

Keep all bdapps and PostgreSQL access in this Express service:

```text
AgriSense frontend -> AgriSense/payment backend -> bdapps
                                      |
                                      -> PostgreSQL
```

The live backend is available at:

```text
https://rookiecoders.tech/api/bdapps
```

bdapps currently whitelists only the DigitalOcean public IP `159.65.85.196`. Local or separately hosted backends can run tests, but real provider requests will not be accepted unless the portal whitelist is updated. The production Node service may listen internally on `127.0.0.1:4317`; provider traffic still leaves the droplet from `159.65.85.196`.

## Install and verify

Requirements:

- Node.js 20 or newer
- npm
- PostgreSQL 16, or access to the managed PostgreSQL URL in `.env`
- Docker only if using the optional local database

```powershell
npm.cmd ci
npm.cmd test
npm.cmd run build
```

The test suite mocks bdapps. It does not send OTPs, SMS messages, or debit money.

For a disposable local database, replace `DATABASE_URL` with the local value from `.env.example`, then run:

```powershell
docker compose up -d db
npm.cmd run db:migrate
npm.cmd run dev
```

Do not run migrations against an unfamiliar database URL. The included production `.env` points to the real managed database.

## Operator authorization

Dashboard and operator routes require:

```http
Authorization: Bearer <PAYMENT_ADMIN_TOKEN>
```

The token must be attached by trusted backend code or entered into the protected operator dashboard. Do not hardcode it into a public frontend bundle.

## Payment flow

Submit a real debit only from a trusted backend:

```http
POST /api/bdapps/caas/direct-debit
Content-Type: application/json
Authorization: Bearer <PAYMENT_ADMIN_TOKEN>

{
  "mobile": "8801845082101",
  "amount": "5.00",
  "confirmCharge": true,
  "externalTrxId": "32_character_unique_identifier"
}
```

Rules:

- Allowed amount: `5.00` to `100.00` BDT.
- `confirmCharge` must be exactly `true`.
- Use a unique identifier of at most 32 letters, digits, `_`, or `-`.
- Submit each transaction ID only once.
- Never automatically retry a debit after a timeout or unknown result.
- Query the durable transaction record before deciding what happened.

Transaction lookup:

```http
GET /api/bdapps/caas/transactions/<externalTrxId>
Authorization: Bearer <PAYMENT_ADMIN_TOKEN>
```

Durable states are `PENDING`, `SUCCEEDED`, `FAILED`, and `UNKNOWN`.

## Dashboard and history APIs

```text
GET /api/bdapps/dashboard/summary
GET /api/bdapps/caas/transactions?limit=25&offset=0&state=SUCCEEDED&query=...
GET /api/bdapps/events?limit=25&offset=0&type=caas.notification&query=...
```

All require operator authorization. The UI is deployed at:

```text
https://rookiecoders.tech/payments/
```

## Other provider routes

```text
POST /api/bdapps/otp/request
POST /api/bdapps/otp/verify
POST /api/bdapps/subscription/status
POST /api/bdapps/subscription/subscribe
POST /api/bdapps/subscription/unsubscribe
POST /api/bdapps/sms/send
POST /api/bdapps/ussd/send
POST /api/bdapps/caas/balance
POST /api/bdapps/caas/payment-instruments
```

Callback endpoints remain public because bdapps calls them directly:

```text
POST /api/bdapps/webhooks/sms
POST /api/bdapps/webhooks/sms-delivery
POST /api/bdapps/webhooks/ussd
POST /api/bdapps/webhooks/subscription
POST /api/bdapps/caas/notify
```

## Cross-origin integration

The production `.env` currently allows the frontend origin configured in `CLIENT_ORIGIN`. If Koushik integrates from another browser domain, update `CLIENT_ORIGIN` and redeploy the backend. Prefer same-origin requests or a trusted backend-to-backend integration instead of broadly enabling CORS.

## Deployment

Deployment assets are in `deploy/`:

- `agrisense-payment.service` — systemd unit
- `nginx-payment.conf` — `/payments/` and `/api/bdapps/` routing
- `configure-production.mjs` — versioned-release setup

Current production layout:

```text
/opt/agrisense-payment/releases/<release-id>
/opt/agrisense-payment/current -> active release
```

Always create a new release directory, run tests and the database migration, switch the `current` symlink, restart `agrisense-payment.service`, and verify the public HTTPS health/dashboard endpoints.
