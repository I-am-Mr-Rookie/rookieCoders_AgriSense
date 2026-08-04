# Payment service integration

This package contains the optional AgriSense bdapps adapter: a small Express service, React operator console, PostgreSQL schema, and deployment assets for OTP, CaaS balance, payment instruments, callbacks, and explicit one-time prototype charges.

## Security boundary

Keep bdapps, database, and operator credentials in the server environment only. Never upload a production `.env`, import it into React, or place `BDAPPS_PASSWORD`, `DATABASE_URL`, or `PAYMENT_ADMIN_TOKEN` in a browser bundle. Rotate credentials after an accidental exposure.

## Integration architecture

```text
AgriSense frontend -> AgriSense/payment backend -> bdapps
                                      |
                                      -> PostgreSQL
```

Use a trusted HTTPS origin and configure the provider callbacks to point to the backend routes described in the package README. Local and automated tests mock provider calls; they do not send SMS, request OTPs, or debit an account.

## Release checklist

1. Configure a disposable or managed PostgreSQL database.
2. Run the migration and the server test suite.
3. Verify callback signatures, idempotency keys, amount bounds, and explicit charge consent.
4. Deploy behind HTTPS with a secret manager and restricted operator routes.
5. Verify health and mocked flows before requesting any real OTP or charge.
