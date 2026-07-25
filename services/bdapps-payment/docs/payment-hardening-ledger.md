# Payment hardening defect ledger

Authority order: latest user instruction, live bdapps provisioning portal, current bdapps OpenAPI, supplied bdapps API Guide v1.1.3, executable evidence, prior review.

## Summary

| Metric | Count |
|---|---:|
| Candidate reports | 12 |
| Unique confirmed defects | 11 |
| Confirmed | 11 |
| Complete with regression | 11 |
| Hardening only | 1 |

## Contract-to-plan delta

| Topic | Official source | Previous implementation | Decision |
|---|---|---|---|
| Balance endpoint | Current OpenAPI uses `/caas/get/balance`; PDF v1.1.3 uses `/caas/balance/query` | Legacy path only | Prefer current path and safely fall back for balance queries only |
| Payment instrument | Current OpenAPI requires `MobileAccount`; PDF uses `Mobile Account` | `Mobile Account` | Make the value configurable and use `MobileAccount` in production |
| Direct debit | `/caas/direct/debit`; `externalTrxId` is 32 characters | Correct path; generated UUID is 36 characters | Preserve path; generate and validate 32-character IDs |
| Retry behavior | Duplicate error `E1337`; temporary failures exist | No durable pending/unknown state | Never automatically retry debit; persist before outbound I/O |
| Callback | Supplied contract documents synchronous debit response | Public callback could mutate transactions | Keep callback event capture but prohibit payment-state mutation |
| Authorization | Payment credentials must remain server-side | Public operator routes | Require a bearer operator token and explicit charge confirmation |
| Subscription gate | Live portal says CaaS `Subscription Required: NO` | Server blocked unregistered subscribers | Make the gate configurable and disable it for this application |
| Debit limits | Live portal allows 5–100 BDT | Server allowed values above zero through 1000 BDT | Enforce 5–100 BDT locally before provider I/O |

## Findings

| ID | Observable failure | Root cause | State | Evidence before | Required fix | Evidence after |
|---|---|---|---|---|---|---|
| PAY-001 | Public callers can invoke debit | No operator authentication | COMPLETE (CONFIRMED) | Static route inspection | Bearer authorization for operator APIs | Unit regression and production unauthenticated probe return 401 |
| PAY-002 | Generated transaction ID exceeds contract | Hyphenated UUID is 36 characters | COMPLETE (CONFIRMED) | PDF/OpenAPI and route inspection | Generate 32-character hexadecimal ID | Regression asserts 32 lowercase hexadecimal characters |
| PAY-003 | Timeout can lose a completed charge | Transaction saved only after provider response | COMPLETE (CONFIRMED) | Route/repository inspection | Insert `PENDING` first; update to `SUCCEEDED`, `FAILED`, or `UNKNOWN` | Ordered regression verifies insert before debit and durable `UNKNOWN` |
| PAY-004 | Duplicate client request can call provider twice | Database uniqueness occurs after outbound request | COMPLETE (CONFIRMED) | Route/repository inspection | Winner-gated insert before provider call | Duplicate regression records exactly one provider debit |
| PAY-005 | Callback can spoof transaction success | Unverified callback writes transaction state | COMPLETE (CONFIRMED) | Callback inspection | Record callback only; do not mutate transactions | Unit regression and production callback S1000 probe |
| PAY-006 | Balance/list calls return HTML/404 | API-version and provisioning drift | COMPLETE (CONFIRMED) | Live HTTP probes | Configurable paths, safe balance fallback, diagnostic metadata | Current/legacy fallback regression passes; production returns redacted upstream 404 diagnostics |
| PAY-007 | Payment tests do not verify the debit contract | CaaS methods are only mocked as success | COMPLETE (CONFIRMED) | Baseline suite: 4 tests | Add auth, payload, duplicate, timeout, callback, and error tests | Final suite: 17/17 passed |
| PAY-008 | Raw control desk response is not a receipt | Demo-only UI | COMPLETE (HARDENING_ONLY) | UI inspection | Return and display a structured receipt | Production build and deployed `/payments/` asset verification passed |
| PAY-009 | OTP registration is rejected before payment | Mandatory application metadata fields are missing | COMPLETE (CONFIRMED) | Live provider response `E1312` and supplied API examples | Send complete web-client metadata and surface provider validation as 422 | Two regressions pass; live OTP request returns S1000/reference number |
| PAY-010 | Valid CaaS debit was blocked for an unregistered number | Assumed subscription prerequisite conflicts with portal setting | COMPLETE (CONFIRMED) | Live portal: `Subscription Required: NO` | Add configurable prerequisite and disable it in production | Regression verifies optional gate; production env is `false` |
| PAY-011 | Server accepted amounts outside provider limits | Local default was 0.01–1000 BDT | COMPLETE (CONFIRMED) | Live portal: minimum 5 BDT, maximum 100 BDT | Enforce and display the exact portal range | Regression and production 4.99 BDT probe return 400 before provider I/O |
| PAY-012 | Live 5 BDT debit rejected with `E1371` | Direct debit sent OpenAPI-style `MobileAccount`, but the provisioned Robi instrument is `Mobile Account` | COMPLETE (CONFIRMED) | Provider receipt and durable failed transaction `a81641a031914f5fa0a447b7120f981e` | Configure a direct-debit-specific instrument value | Regression passed; release `20260724213952`; corrected live debit returned S1000 |

## Baseline

- `npm.cmd test`: 4/4 passed before patches.
- `VITE_BASE_PATH=/payments/ npm.cmd run build`: passed before patches.
- `npm.cmd audit --omit=dev --audit-level=high`: zero vulnerabilities.
- Live subscriber status for the supplied number: `UNREGISTERED`.
- Legacy balance/list endpoints returned non-JSON upstream responses.

## Final evidence

- `npm.cmd test`: 18/18 passed.
- `VITE_BASE_PATH=/payments/ npm.cmd run build`: passed.
- `npm.cmd audit --omit=dev --audit-level=high`: zero vulnerabilities.
- Local migration: blocked by unavailable local PostgreSQL at `127.0.0.1:5433`.
- Production migration: passed against the managed PostgreSQL database.
- Production release: `/opt/agrisense-payment/releases/20260724213952`.
- Production service, Nginx syntax, HTTPS health, operator 401 boundary, public callback S1000, and UI route: passed.
- Live portal confirms APP_139263 is Pro, `8801845082101` is whitelisted, debit requests and Robi Mobile Account are enabled, callback is correct, subscription is not required, and the debit range is 5–100 BDT.
- A zero-risk invalid-credential probe confirms `/caas/direct/debit` is live and returns JSON `E1313` rather than HTTP 404.
- A fresh real-credential zero-BDT probe for `8801845082101` reached `/caas/direct/debit` and returned JSON `E1312 Invalid request`; this verifies live application authentication without creating a monetary charge (external ID `b1526e9480b84418a83e97e5a7ac02ea`).
- Fresh live subscription data returns `S1000` and `UNREGISTERED`; the portal explicitly configures CaaS subscription as not required.
- CaaS balance and payment-instrument paths remain unavailable upstream with HTTP 404; these discovery calls are not prerequisites for direct debit.
- Authorized live debit: 5.00 BDT charged successfully to `8801845082101`; external transaction `e4737bdcfb15498e87450371ef1ed593`, internal transaction `926072503424049394`, provider status `S1000`, durable state `SUCCEEDED`, attempt count 1.

## Recovery state

- Target: `E:\Agri-Sense\bdapps-react-express-postgres`
- Git: no repository at this directory.
- Deadline mode: normal.
- Deployment target: versioned releases under `/opt/agrisense-payment/releases`.
- Active production service: `agrisense-payment.service`, release `20260724213952`.
- The requested 5.00 BDT live debit is complete and verified.
