# AgriSense authenticated farmer agent design

## Product decision

AgriSense becomes a two-surface product. The public surface is a focused brand landing page with exactly three actions: Sign up, Login, and GitHub. The private surface is the existing Tier 1 and Tier 2 farmer-agent workspace, available only after bdapps OTP verification.

Login and sign-up intentionally share one identity flow. A verified Bangladesh mobile number is the account identity; there are no passwords, social providers, or duplicate onboarding forms.

## Architecture

```text
Browser
  |-- public landing and OTP dialog
  |-- authenticated farmer workspace
  |
AgriSense Express server
  |-- server-only bdapps OTP adapter
  |-- opaque HttpOnly session cookie
  |-- mobile-hash -> farmer account -> deterministic memory binding
  |-- Tier 1 planning and Tier 2 market/image/voice APIs
  |
  +-- existing bdapps payment service on the same VPS
  +-- PostgreSQL
  +-- OpenAI APIs
```

The browser never receives `PAYMENT_ADMIN_TOKEN`, bdapps credentials, an OpenAI standard API key, or a database URL. OTP and payment-service calls are backend-to-backend. The farmer UI does not expose direct debit or operator history controls.

## Identity and persistence

- Accept Bangladesh mobile numbers in the exact international form used for the demonstration, including `8801845082101`.
- Request and verify OTP through the existing `/api/bdapps/otp/*` service with the operator token attached only by AgriSense's server.
- Store a keyed hash of the normalized mobile number plus its last four digits; do not store the raw number in the AgriSense user table.
- Issue a random session token in a `HttpOnly`, `SameSite=Lax` cookie. Store only its SHA-256 hash in PostgreSQL and expire it after 30 days.
- Derive a stable internal farmer-memory key from the user ID and `AUTH_SESSION_SECRET`. The same verified number therefore resumes the same compact profile, session summaries, plans, and conversation list on every device.
- Retain the existing recovery-code flow as a secondary portability mechanism, not the primary login experience.
- Use bounded OTP throttling and generic error responses so the public endpoint cannot become an SMS relay or account-enumeration oracle.

## User experience

### Public landing

The page has no navigation or secondary links. AgriSense branding, one farmer-centered promise, a restrained animated field/orbit signature, and the three requested actions occupy one viewport. Sign up is the primary action; Login is secondary; GitHub is a quiet repository action.

Clicking Sign up or Login opens the same accessible two-step dialog:

1. Mobile number and `Send OTP`.
2. Six-digit OTP and `Verify and continue`, with change-number and resend controls.

No request fires automatically. The supplied demo number is prefilled exactly as `8801845082101`.

### Authenticated workspace

The farmer lands directly in the chat-first agent workspace. The session list, account-bound memory, market search, plant-image assessment, crop plan, reports, and evidence remain available. The header gains a compact account indicator and Log out action.

Bangla voice uses a dedicated circular listening overlay inspired by familiar voice assistants without copying proprietary code or assets. The orb reflects connecting, listening, speaking, and fallback states; live Bangla/English transcript text remains editable in the composer. Reduced-motion mode removes orbital animation.

## Error and safety behavior

- Invalid numbers and OTPs receive specific corrective messages without revealing whether an account existed.
- Provider timeouts remain retryable and never create a local authenticated session.
- Authentication is established only after provider verification succeeds.
- Logout invalidates the server session before clearing the cookie.
- A missing PostgreSQL connection permits local test fallback but is visibly reported as non-durable; production readiness requires PostgreSQL.
- No live debit is performed during implementation verification.

## Verification

- Unit tests: mobile normalization, provider request contract, secret non-disclosure, session hashing/cookies, expiry, account upsert, stable memory binding, OTP throttling, and failure mapping.
- API tests: request, verify, session restore, logout, unauthenticated state, and payment health.
- UI contract tests: the three-action landing page, two-step dialog, authenticated redirect, logout, voice orb, image upload, market mode, and no browser credential leakage.
- Browser acceptance: desktop and mobile landing, keyboard dialog, validation errors, mocked full login, dashboard navigation, chat, image, market, voice fallback, logout, no overflow, and no console errors.
- Live boundary check: public payment health and HTTPS dashboard availability. A real OTP verification is completed by Koushik during the requested post-push hands-on verification because the delivered code is sent only to the supplied handset.

## Scope boundary

This release does not add social login, passwords, automatic charging, a public operator console, biometric identity, or external notification delivery. Stress testing, adversarial evolution, patching, and re-evaluation begin only after Koushik approves the pushed release.
