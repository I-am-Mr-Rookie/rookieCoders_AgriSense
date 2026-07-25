# AgriSense Daily Access and Secure Login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separate subscription enrollment from returning-user OTP login, enforce idempotent BDT 5 daily access, simplify farmer billing UI, and stabilize Bangla/Banglish voice transcripts.

**Architecture:** `server/auth.js` routes signup through bdapps enrollment OTP and login through a PostgreSQL-backed hashed SMS challenge. A focused daily-access service owns idempotent entitlement decisions and subscription cancellation. The React workspace renders farmer-facing access state only.

**Tech Stack:** Node.js, Express, PostgreSQL, React, bdapps internal service, OpenAI Realtime, Node test runner.

---

### Task 1: Dual OTP authentication

**Files:** `server/auth.js`, `server/auth-http.js`, `server/db.js`, `server/index.js`, `server/migrations/001_farm_sessions.sql`, `tests/auth.test.js`

- [ ] Add failing tests for registered login, unregistered signup, challenge expiry, attempt limits, and one-time use.
- [ ] Run `node --test tests/auth.test.js` and confirm the new cases fail for missing behavior.
- [ ] Add bdapps subscription-status and SMS methods, PostgreSQL challenge persistence, and mode-aware request/verify paths.
- [ ] Re-run the focused tests and retain only the minimal passing implementation.

### Task 2: Daily entitlement and cancellation

**Files:** `server/daily-access.js`, `server/payment-gateway.js`, `server/payment-http.js`, `server/db.js`, `server/index.js`, `tests/daily-access.test.js`, `tests/payment-http.test.js`

- [ ] Add failing tests proving one charge ID per Dhaka date, same-day reuse, failed-charge denial, authenticated cancellation, and no raw mobile response.
- [ ] Implement encrypted mobile persistence, an idempotent entitlement ledger, mocked-by-default gateway calls, and authenticated cancellation.
- [ ] Run focused billing tests; no live debit request is permitted in the test suite.

### Task 3: Farmer-facing access UI

**Files:** `src/components/PaymentGatewayCard.jsx`, `src/App.jsx`, `src/styles.css`, `tests/payment-integration-contract.test.js`

- [ ] Replace operator-dashboard expectations with failing tests for BDT 5/day status and Cancel subscription.
- [ ] Remove the external operator link and gateway configuration language.
- [ ] Add a compact confirmation-based cancellation control and localized state copy.
- [ ] Run the focused UI contract and build.

### Task 4: Natural ordered voice interaction

**Files:** `server/realtime.js`, `src/realtime.js`, `src/App.jsx`, `tests/realtime.test.js`

- [ ] Add failing tests for natural turn configuration and ordered partial/final transcript accumulation.
- [ ] Tune the Realtime session and reducer without exposing private reasoning.
- [ ] Run the voice tests and confirm the typed-chat fallback remains intact.

### Task 5: Stress, deployment, and delivery

**Files:** `docs/stress-report.md`, `README.md`

- [ ] Run focused suites, full `npm test`, `npm run build`, `npm audit --omit=dev`, secret scan, and idempotency/concurrency probes.
- [ ] Score the unchanged 100-point readiness rubric; patch only reproduced failures until at least 95 or the deadline hard stop.
- [ ] Deploy the verified release to the VPS without a live debit, run signed-in desktop/mobile browser checks, and verify reload persistence.
- [ ] Inspect Git status/diff, scan staged content for secrets, commit, push, and verify the remote revision.
