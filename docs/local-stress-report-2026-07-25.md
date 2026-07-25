# AgriSense Local Stress Test — 2026-07-25

## Verdict

**Not submission-ready at a 95% evidence threshold.** The local deterministic build is stable under the executed load, concurrency, malformed-input, browser, build, test, dependency, and secret checks. However, live OpenAI orchestration, PostgreSQL persistence, real microphone behavior, and bdapps payment/receipt behavior were not available in this local environment. Production, VPS, GitHub, and chargeable OTP/payment actions were explicitly excluded.

## Frozen scoring model

### Internal execution readiness — 83/100

| Dimension | Weight | Score | Evidence gap |
| --- | ---: | ---: | --- |
| Functional and contract correctness | 35 | 33 | Live model-backed path unavailable locally |
| Critical edge, failure, and concurrency behavior | 20 | 19 | PostgreSQL contention not exercised; memory fallback only |
| Regression and demo reliability | 15 | 12 | Full paid/authenticated provider journey not run |
| Clean setup and target reproducibility | 15 | 8 | No local OpenAI key, PostgreSQL, or bdapps sandbox transaction |
| Submission, secrets, docs, and Git hygiene | 10 | 7 | GitHub/VPS deliberately untouched; deployment evidence not refreshed |
| Maintainability | 5 | 4 | Broad test coverage; some server/logging paths still need production observability |
| **Total** | **100** | **83** | **Below 95** |

### Organizer-rubric evidence score — 75/100

| Criterion | Weight | Evidence-backed score | Reason for deduction |
| --- | ---: | ---: | --- |
| Agentic behavior | 20 | 15 | Tool routes and streamed events are tested, but no live model/tool run locally |
| Scope and execution | 15 | 12 | Major Tier 1/2 routes exist; full provider-backed farmer journey was not exercised |
| Accuracy and practicality | 20 | 16 | Deterministic, RAG, budget, safety, and plan tests pass; live answer quality remains unmeasured |
| Knowledge base | 12 | 11 | 1,976 indexed records across 9 datasets; source-policy tests pass |
| bdapps payment | 10 | 3 | Contract/unit coverage only; no fresh simulator debit, callback, receipt, or cancellation proof |
| Explainability | 10 | 8 | Collapsible activity and evidence UI verified; live reasoning summaries not exercised |
| Technical implementation | 8 | 7 | Build, audit, concurrency, responsive layout, and error handling pass locally |
| Innovation | 5 | 3 | Market, image, and voice surfaces exist; provider-backed E2E proof is absent |
| **Total** | **100** | **75** | **Below 95** |

## Executed evidence

### Automated verification

- `npm.cmd run check`: **246/246 tests passed**, production build passed, `npm audit --omit=dev` reported **0 vulnerabilities**, and `git diff --check` passed apart from line-ending warnings.
- Secret scan for OpenAI project-key prefixes: **clean**.
- Post-storm health: `GET /api/health` returned **200** with 9 datasets, 1,976 indexed records, and 2 blocked records excluded.

### Concurrent load — 500 requests, concurrency 50

| Route/intent | Success | p50 | p95 | Max |
| --- | ---: | ---: | ---: | ---: |
| Health | 100/100 | 90 ms | 296 ms | 361 ms |
| Flood assistance | 100/100 | 90 ms | 358 ms | 413 ms |
| Disease/image assistance | 100/100 | 92 ms | 363 ms | 415 ms |
| Voice assistance | 100/100 | 92 ms | 365 ms | 416 ms |
| Rabi clarification | 100/100 | 90 ms | 368 ms | 418 ms |

All response-content assertions passed. No request failed and the process remained healthy.

### Memory concurrency

- 100 simultaneous session writes returned **100 HTTP 201 responses**.
- The final memory retained the configured newest **20/20 unique sessions**, including `stress-97`, `stress-98`, and `stress-99`.
- This verifies the local in-memory retention bound, not PostgreSQL transaction isolation.

### Hostile input and recovery

- 100 malformed JSON requests returned **100 HTTP 400 responses**.
- 30 oversized JSON requests returned **30 HTTP 413 responses**.
- The health endpoint returned **200** immediately after the error storm.
- The server process remained listening at about **91.5 MB working set**.

### User-level browser acceptance

- Tested through the Codex signed-in in-app browser at `390 x 844` against `http://127.0.0.1:3003/`.
- `clientWidth` and `scrollWidth` were both **390 px**: no horizontal overflow.
- Bangla mobile landing, sign-up disclosure, and password login were visually inspected.
- Sign-up clearly disclosed the one-time BDT 5 charge; Send OTP remained disabled without consent.
- Login stated that password login causes no OTP or new charge.
- Browser warning/error console: **empty**.
- The normal browser viewport was restored after the mobile test.

## Finding ledger

| ID | State | Evidence level | Finding |
| --- | --- | --- | --- |
| STRESS-01 | FALSE_POSITIVE | E3 | 500-request local load did not crash, time out, or violate response assertions |
| STRESS-02 | FALSE_POSITIVE | E3 | 100 concurrent local session writes respected the 20-session retention invariant |
| STRESS-03 | FALSE_POSITIVE | E3 | Malformed and oversized payload storms produced controlled 400/413 responses and recovery |
| STRESS-04 | UNRESOLVED | E1 | Live OpenAI model/tool orchestration unavailable because the local process uses deterministic fallback |
| STRESS-05 | UNRESOLVED | E1 | Durable multi-login memory under PostgreSQL was not exercised; local mode uses memory fallback |
| BILL-RECUR-01 | CONFIRMED, PATCHED | E3 | A stale `DAILY_BILLING_ENABLED=true` environment value could reactivate returning-user debits. The server now hard-locks recurring billing off, with a regression test. |
| BILL-CLIENT-01 | CONFIRMED, PATCHED | E3 | A dormant recurring-subscription cancellation function and copy remained in the farmer bundle. They were removed and protected by a source-contract regression test. |
| BILL-JUDGE-01 | UNRESOLVED | E1 | No fresh bdapps simulator debit, callback, receipt, or cancellation verification; no chargeable action was attempted |
| VOICE-TONE-01 | UNRESOLVED | E1 | Real Bangla/English microphone recognition, barge-in, naturalness, and read-aloud were not acceptance-tested |
| DEPLOY-01 | OUT_OF_SCOPE | E0 | VPS and production verification prohibited for this loop |
| RELEASE-01 | OUT_OF_SCOPE | E0 | Commit, push, and GitHub publishing prohibited for this loop |

## Log audit

The stderr file contained one old `sendFile(.../dist/index.html)` `NotFoundError`, consistent with a request before a build artifact existed. A fresh root request returned **200**, `dist/index.html` exists, and the request added **0 bytes** to the error log. No unhandled rejection, fatal error, address conflict, or out-of-memory signature was found.

## Required evidence before claiming 95+

1. Start the same build with valid OpenAI credentials and prove actual tool invocation, citations, image analysis, market retrieval, safe reasoning summaries, and latency.
2. Run PostgreSQL-backed concurrent memory, logout/login, multi-session, and restart persistence tests.
3. Test real Bangla and English microphones on an Android-class device, including noisy audio, code-switching, interruption, and natural speech output.
4. With explicit approval, execute one bdapps sandbox first-time payment and one returning password login; verify callback authenticity, receipt, idempotency, cancellation, and absence of a second charge.
5. Only after those pass, run a clean target-environment smoke test and refresh the official judge score.

## Actions intentionally not taken

- No OTP, payment, debit, subscription, or live provider transaction.
- No Git staging, commit, push, pull request, or GitHub mutation.
- No VPS, domain, production, DNS, database, capacity, or deployment mutation.
