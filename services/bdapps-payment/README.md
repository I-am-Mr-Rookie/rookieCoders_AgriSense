# AgriSense bdapps integration

React + Express + PostgreSQL replacement for the supplied PHP samples. It implements OTP subscription, subscription status/change, SMS, USSD, CaaS balance/payment instruments/direct debit, and inbound callbacks.

## Start locally

```powershell
Copy-Item .env.example .env
docker compose up -d db
npm.cmd install
npm.cmd run db:migrate
npm.cmd run dev
```

- React: `http://127.0.0.1:3000`
- Express: `http://127.0.0.1:4317`
- PostgreSQL: `127.0.0.1:5433`

Put the real `BDAPPS_APPLICATION_ID`, `BDAPPS_PASSWORD`, and optional Android `BDAPPS_APPLICATION_HASH` in `.env`. Credentials never go to React or browser storage.

## Configure in the bdapps portal

Use public HTTPS URLs that proxy to the Express server:

- SMS listener: `/api/bdapps/webhooks/sms`
- SMS delivery report: `/api/bdapps/webhooks/sms-delivery`
- USSD listener: `/api/bdapps/webhooks/ussd`
- Subscription listener: `/api/bdapps/webhooks/subscription`
- CaaS notification: `/api/bdapps/caas/notify`
- Health check: `/health`

The existing AgriSense CaaS path is retained, so its deployed bdapps portal configuration does not need to change. The IP-based listener URLs shown in the supplied training deck belong to bdapps-provided hosting; use your own HTTPS host for this server.

## API routes

All application calls use `POST` with JSON.

- `/api/bdapps/otp/request`, `/api/bdapps/otp/verify`
- `/api/bdapps/subscription/status`, `/subscribe`, `/unsubscribe`
- `/api/bdapps/sms/send`, `/api/bdapps/ussd/send`
- `/api/bdapps/caas/balance`, `/payment-instruments`, `/direct-debit`
- `GET /api/bdapps/events?limit=50`

## Verification

```powershell
npm.cmd test
npm.cmd run build
```

Tests mock bdapps, so they do not send SMS, charge money, or consume production credentials.
