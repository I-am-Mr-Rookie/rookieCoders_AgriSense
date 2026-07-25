# DigitalOcean deployment

The production deployment uses the existing Droplet and managed PostgreSQL cluster.

- Runtime: `/opt/agrisense-payment/current`
- Service: `agrisense-payment.service` on `127.0.0.1:4317`
- UI: `https://rookiecoders.tech/payments/`
- Health: `https://rookiecoders.tech/api/bdapps/health`
- bdapps callbacks and API: `https://rookiecoders.tech/api/bdapps/...`

The Nginx snippet is included only in the existing HTTPS virtual host, so the main
AgriSense application remains routed to port 3002.

Operator API routes require `Authorization: Bearer <PAYMENT_ADMIN_TOKEN>`. The
deployment helper preserves an existing strong token or creates a new 64-character
token. The browser control desk keeps the pasted token in React memory only and
does not write it to local storage.
