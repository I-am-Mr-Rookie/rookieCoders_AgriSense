# AgriSense Tier 1 Validation Evidence

Date: 25 July 2026, Asia/Dhaka

Scope: local implementation and verification only

## Automated gate

Command:

```powershell
npm.cmd run check
```

Result:

- 103 tests passed;
- 0 tests failed;
- Vite production build passed;
- output bundle created successfully;
- the preceding dependency installation audit reported 0 vulnerabilities.

Coverage includes memory lifecycle and redaction, schedule safety, activity ordering and sanitization, NDJSON chunk handling, reasoning policy, API reasoning-summary boundaries, weather caching, workflow timings, Markdown/theme contracts, card geometry contracts, recovery behavior, RAG integrity, and the full Tier 0 regression suite.

## Local API gate

Environment:

- `OPENAI_API_KEY`: not configured;
- `DATABASE_URL`: not configured;
- explanation mode: deterministic grounded fallback;
- persistence mode: process memory.

Observed:

- health phase: `Tier-1`;
- memory recovery-ID format valid;
- memory create/resume/reset passed;
- creating memory after a plan captured that plan, and resume returned it;
- recovered farm data won over stale browser-session data;
- process-memory fallback was reported explicitly;
- stream returned 11 ordered activity events;
- schedule returned two operations;
- a live forecast day with at least 10 mm rain triggered the reachable irrigation adjustment path;
- final crop plan returned successfully;
- activity stream contained no recovery ID.
- recovery IDs ending in a base64url `-` are redacted before network/model use;
- aborted client requests stop before ranking/model completion; cancellation during a save restores the previous result;
- preference changes persist immediately, serialize against plan writes, and survive resume.
- a live concurrent plan plus preference API probe preserved both the completed plan and the newest preference.

## Browser gate

Playwright CLI session against `http://127.0.0.1:3001`:

- initial and completed UI rendered;
- demo produced recommendation, schedule, activity, ranking, roadmap, knowledge, and trace;
- console errors: 0;
- mobile viewport: 390×844;
- mobile `scrollWidth`: 390;
- theme after selection: `dark`;
- theme after reload: `dark`;
- process-memory durability warning visible: true;
- newly created memory showed previous plan available: true;
- fresh demo request contained connected memory ID: false;
- cancel produced a cancelled state and exposed retry: true;
- crop heights before disclosure: `[248,248,248,248]`;
- crop heights after opening the first disclosure: `[340,248,248,248]`;
- open crop disclosures: 1.

## Latency gate

Measured locally without an OpenAI call:

| Run | HTTP | Weather | Retrieval | Agent | Outcome |
|---|---:|---:|---:|---:|---|
| First cold attempt | 7,081 ms | timed out | not reached | not reached | sanitized failure event |
| Successful uncached attempt | 2,206 ms | 1,967 ms | 225 ms | 1 ms | success |
| Cached attempt | 87 ms | 0 ms | 47 ms | 0 ms | success |

Interpretation:

- the local deterministic application path is well below ten seconds;
- the dominant measured cold-path cost is Open-Meteo network access;
- model and VPS/proxy costs were not measurable in this secret-free local run;
- the five-minute weather cache removes both geocoding and forecast calls for repeated normalized locations;
- NDJSON responses disable proxy buffering with `X-Accel-Buffering: no`.

## Remaining production gate

Before claiming production under ten seconds:

1. measure DNS, TLS, geocoding, forecast, OpenAI first activity, and OpenAI completion on the VPS;
2. confirm Nginx buffering is disabled for the stream route;
3. inspect CPU steal, available RAM, swap, event-loop lag, and process restarts;
4. run at least 10 cold and 20 warm requests and report p50/p95;
5. resize the VPS only if those measurements identify sustained resource pressure.

No VPS, deployment, billing, or account mutation was authorized or performed in this phase.
