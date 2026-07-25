# Production operations dashboard

The dashboard at `https://rookiecoders.tech/payments/` reads transaction and callback history from the production PostgreSQL database. It does not generate sample records or infer provider outcomes.

## Authentication

All dashboard endpoints require the same operator bearer token as the payment controls:

```http
Authorization: Bearer <PAYMENT_ADMIN_TOKEN>
```

The browser keeps the token only in React memory for the current page session.

## Database-backed endpoints

- `GET /api/bdapps/dashboard/summary`
  - transaction counts by durable state
  - total succeeded amount
  - callback count
  - latest transaction and callback timestamps
- `GET /api/bdapps/caas/transactions?limit=25&offset=0&state=SUCCEEDED&query=...`
  - paginated transaction history
  - optional durable-state filter
  - search across transaction IDs, subscriber IDs, provider codes, and provider detail
- `GET /api/bdapps/events?limit=25&offset=0&type=caas.notification&query=...`
  - paginated callback log history
  - optional event-type filter
  - search across identifiers and persisted JSON payloads

Limits are capped at 100 records per request. Invalid states, offsets, limits, and oversized search values are rejected before querying PostgreSQL.

## Dashboard behavior

- Summary values are direct database aggregates.
- Transaction rows show amount, subscriber, provider status, durable state, and attempt count.
- Expanded rows show the request persisted before provider I/O and the provider response stored afterward.
- Callback rows expose the original persisted JSON payload.
- Payment, OTP, SMS, and subscription actions are separated under **Operator tools**.
- Direct debit remains protected by explicit confirmation and is never automatically retried.
