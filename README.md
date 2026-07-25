# Rookie Coders — AgriSense Tier 2

AgriSense is an evidence-backed Bangladesh farm-planning agent for the IUT 12th ICT Fest Bdapps Agentic AI Hackathon.

The public product opens with a focused landing page. First-time enrollment uses bdapps mobile OTP and a one-time BDT 5 prototype payment, then the farmer creates a numeric password. Returning farmers sign in with their mobile number and password without another OTP or charge. A verified mobile number resumes one PostgreSQL-backed farmer workspace across conversation sessions. The approved demonstration number is `8801845082101`; the application never requests an OTP automatically.

## Implemented

- targeted intake for location, farm size, soil, water, budget, and season;
- live seven-day Bangladesh weather from Open-Meteo;
- four Rabi crop recommendations influenced by farm context, weather, finance, and BARC crop-zoning evidence;
- six dated checkpoints from land preparation through harvest;
- deterministic fertilizer and irrigation scheduling with costs, confirmation boundaries, and rain-based irrigation adjustment;
- optional private farm memory with create, resume, update, and forget controls;
- streamed, expandable agent activity for requests, tools, retrieved domains, and returned data;
- safe Markdown and GitHub-flavored Markdown rendering with raw HTML disabled;
- light, dark, and system themes;
- medium reasoning by default, with deterministic high-reasoning escalation for difficult comparison, simulation, optimization, and trade-off requests;
- API-provided reasoning summaries when available, without exposing private raw chain-of-thought;
- 1,976 indexed fact cards from nine structured public-source datasets;
- PostgreSQL persistence with a labeled process-memory fallback;
- per-phase weather, retrieval, agent, and total latency measurements;
- a five-minute Open-Meteo cache with in-flight deduplication for repeated normalized locations;
- English and natural বাংলা interface/agent response modes, with mixed Bangla/English and Banglish input understanding;
- live web-search market prices and supplier comparisons with citations;
- cautious image-based plant-disease assessment with no unsupported chemical advice;
- Bangla/English Realtime voice with a dedicated listening interface and editable transcript fallback;
- server-only bdapps OTP enrollment with opaque HttpOnly sessions, salted password hashes, and hashed mobile identities;
- one-time BDT 5 prototype enrollment integration; recurring daily billing is locked off and no payment controls appear in the farmer workspace;
- recovery-linked multi-session conversations and compact token-optimized memory.

## Official feature tiers

The names below follow `Agentic_AI_Hackathon_Final_Question.pdf` exactly. "Implemented" means the path exists and has local executable evidence; it does not replace a provider-backed live demo.

| Official tier | Official capability | Status in this repository | Current implementation and evidence boundary |
|---|---|---|---|
| Tier 0 — Core | Conversational intake | Implemented | Collects location, farm size, soil, water, budget, and season; asks targeted questions only for missing fields. |
| Tier 0 — Core | Live weather grounding | Implemented | Calls Open-Meteo by farm location and uses returned rainfall and temperature in crop ranking and scheduling. |
| Tier 0 — Core | Crop recommendation | Implemented | Ranks four Rabi candidates with suitability, water need, risk, retrieved evidence, and a scaled financial estimate. |
| Tier 0 — Core | Season plan | Implemented | Creates a dated selected-crop calendar from land preparation through harvest, including input and pest checkpoints. |
| Tier 0 — Core | Financial projection | Implemented | Produces itemized costs, expected yield, revenue, net profit, ROI, and break-even values that change with farm inputs. |
| Tier 0 — Core | Explained reasoning | Implemented | Names relevant farm inputs, live weather, retrieved facts, and team assumptions behind recommendations. |
| Tier 0 — Core | Knowledge base with RAG | Implemented | Retrieves from 1,976 fact cards across nine provenance-rich public-source datasets instead of relying on model recall alone. |
| Tier 0 — Core | Visible agent trace | Implemented | Streams bounded tool parameters, returned values, evidence, timing, and results without exposing private raw chain-of-thought. |
| Tier 1 — Advanced | Persistent memory | Implemented; live PostgreSQL recheck pending | Supports PostgreSQL-backed farm memory and separate recovery-linked conversations; local tests use a labeled process fallback. |
| Tier 1 — Advanced | Proactive, weather-triggered advice | Partial | A fresh forecast can delay irrigation and change the plan, but background monitoring and external alert delivery are not implemented. |
| Tier 1 — Advanced | Fertilizer and irrigation scheduler | Implemented | Produces quantities, growth-stage timing, costs, organic-alternative boundaries, and rain-aware irrigation adjustments. |
| Tier 1 — Advanced | Pest and disease risk | Partial | Plans include preventive checkpoints and image assistance, but a full crop-stage-weather risk/cost engine is not proven end to end. |
| Tier 1 — Advanced | Scenario simulation | Partial | Budget and farm-detail revisions recalculate the plan; the complete rainfall-drop scenario set still needs live acceptance evidence. |
| Tier 2 — Ambitious | Marketplace and supplier comparison | Implemented in source; live acceptance pending | Uses OpenAI web search for current supplier comparisons with visible, deduplicated citations. |
| Tier 2 — Ambitious | Market price intelligence | Implemented in source; live acceptance pending | Retrieves current market evidence and produces a bounded recommendation; historical coverage depends on available sources. |
| Tier 2 — Ambitious | Plant disease detection from images | Implemented in source; live acceptance pending | Sends a validated image to a vision-capable OpenAI model and returns a cautious assessment with uncertainty and no unsupported chemical advice. |
| Tier 2 — Ambitious | bdapps Payment Gateway Integration | Partial; simulator proof pending | Includes explicit-consent OTP enrollment and a one-time BDT 5 prototype payment path. Automated tests mock bdapps; no fresh balance deduction and receipt were claimed. |
| Tier 2 — Ambitious | Bengali or voice interaction | Implemented in source; device acceptance pending | Provides natural Bangla/English UI modes, mixed-language understanding, and OpenAI Realtime voice with an editable transcript fallback. |

Tier status is deliberately conservative. The unresolved provider and device gates are listed in `docs/local-stress-report-2026-07-25.md` and `docs/official-judge-audit.md`.

## Tools and APIs

| Tool or API | Purpose |
|---|---|
| Node.js 22, Express 5 | Same-origin API server, authentication, agent orchestration, persistence, and production hosting. |
| React 19, Vite 7 | Responsive farmer interface and production client build. |
| PostgreSQL (`pg`) | Durable users, salted password hashes, opaque sessions, compact farm memory, conversations, and payment idempotency. |
| OpenAI Responses API | Grounded agent responses, structured extraction, web search, reasoning summaries, and vision requests. |
| OpenAI Realtime API | Ephemeral-credential Bangla/English speech sessions; the standard API key remains server-side. |
| Open-Meteo API | Live seven-day Bangladesh forecast used by ranking and scheduling. |
| bdapps OTP/CaaS service | First-time mobile verification and the explicit one-time BDT 5 prototype payment path. |
| Local RAG datasets | 1,976 indexed fact cards from nine structured public-source agriculture datasets with provenance and confidence fields. |
| Node test runner, contract tests, Vite build | Unit, integration, source-contract, concurrency, hostile-input, and production-build verification. |

## Data: collected, real, derived, and mock

| Classification | Data used | Handling and limitation |
|---|---|---|
| Farmer-collected | Location, farm size, soil, water, budget, season, crop choice, plan edits, preferences, and chat messages. | Used to build the farm profile and plan. PostgreSQL stores durable state when configured; local development clearly labels the in-process fallback. |
| Authentication-collected | Mobile number, explicit payment consent, OTP result, numeric password, and session state. | Handled server-side. Passwords are salted hashes; mobile identities and recovery codes are hashed; browser sessions are opaque HttpOnly tokens. Credentials are excluded from model context and Git. |
| Optional media | Farmer-selected plant image, microphone audio, and editable transcript. | Sent only when the farmer activates that feature. Image/audio processing is provider-backed; outputs are assistance, not a laboratory diagnosis. |
| Real live external data | Open-Meteo forecast; OpenAI web-search results and citations; provider responses when configured. | Time-sensitive and failure-prone. The interface preserves source/freshness information and returns bounded fallbacks when a provider is unavailable. |
| Real retrieved reference data | BARC crop zoning/fertilizer guidance, BAMIS/DAE records, and the supplied structured agriculture corpus. | Stored locally as provenance-rich fact cards. Partial or cautionary records remain labeled. |
| Generated or derived | Crop scores, recommendations, plan text, checkpoints, schedules, cost/yield/profit projections, summaries, market synthesis, and image assessment. | Computed from farmer inputs, retrieved/live evidence, model output, and explicit team coefficients. These are decision support, not guaranteed outcomes. |
| Team assumptions | Base costs, yields, prices, crop coefficients, and default checkpoint offsets. | Deterministic planning inputs, visibly separated from retrieved facts and subject to local expert confirmation. |
| Mock or simulated in automated tests | OpenAI, PostgreSQL fallback behavior, bdapps OTP/payment callbacks, malformed inputs, and concurrency storms. | No OTP, SMS, subscription, or debit is sent by the automated suite. A real bdapps sandbox transaction requires explicit manual approval. |
| Demonstration data | The fresh Gazipur demo profile and approved demonstration mobile number. | Synthetic judge path only; starting it creates an isolated session and does not represent a real farmer. |

## Safety and truth boundaries

| Category | Boundary |
|---|---|
| Live | Open-Meteo responses; OpenAI responses when configured; PostgreSQL writes when configured. |
| Retrieved | BARC crop zoning and fertilizer guidance, BAMIS/DAE records, and supplied structured sources with provenance/confidence fields. |
| Team assumptions | Base crop coefficients, costs, yields, prices, and default checkpoint offsets. |
| Farmer confirmation | Fertilizer operations are never presented as automatically applied. |
| Chemicals | No chemical recommendation is made without current official registry evidence. |
| Memory | The `farm_...` recovery code is a bearer credential. It is hashed before storage and redacted from activity, traces, logs, and model context. |
| Authentication | Raw mobile numbers, OTPs, session tokens, and operator credentials are never placed in browser bundles, activity traces, or model prompts. |
| Payments | The farmer explicitly consents before first-time OTP enrollment. Returning password logins cannot trigger another debit, and the farmer workspace exposes no payment controls. |
| Voice | Bangla speech may be imperfect; prices, dates, quantities, and chemicals require visible text confirmation. |
| Deferred | External alert delivery remains out of scope. |

The corpus contains partial and cautionary records. Exact agronomic dates and financial assumptions require local expert validation.

## Run locally

Requires Node.js 22+.

```powershell
Copy-Item .env.example .env
npm.cmd ci
npm.cmd run check
npm.cmd start
```

Open <http://localhost:3001>. The canonical entry is a blank farmer conversation. **Start fresh Gazipur demo** creates a new isolated demonstration session on every run.

Environment variables:

```text
OPENAI_API_KEY=server-side-only
OPENAI_MODEL=gpt-5.6
OPENAI_REASONING_EFFORT=auto
OPENAI_REALTIME_MODEL=gpt-realtime-2.1
DATABASE_URL=server-side-only
DATABASE_SSL_REJECT_UNAUTHORIZED=true
AUTH_SESSION_SECRET=at-least-32-random-characters
PAYMENT_SERVICE_URL=https://rookiecoders.tech/api/bdapps
PAYMENT_DASHBOARD_URL=https://rookiecoders.tech/payments/
PAYMENT_ADMIN_TOKEN=server-side-only
APP_REVISION=git-revision
PORT=3001
```

Never place secrets in Git, the browser client, activity output, screenshots, or model prompts. Keep database certificate verification enabled.

## Tier 1 local verification

Verified locally on 25 July 2026:

- `npm.cmd run check`: 246/246 tests passed and the Vite production build passed;
- memory create/resume/reset API lifecycle passed without printing the recovery credential;
- streamed planning returned 11 ordered activity events, two schedule items, and a final four-crop plan;
- desktop and 390×844 browser checks found zero console errors and no horizontal overflow;
- crop-card regression: opening the first card changed card heights from `[248,248,248,248]` to `[340,248,248,248]`, with exactly one disclosure open;
- dark mode applied immediately and survived reload;
- successful cold weather + deterministic planning completed in about 2.2 seconds during the measured run;
- a cached run completed in 87 ms end-to-end;
- one preceding cold Open-Meteo attempt reached its seven-second network timeout, identifying external network reliability as the main measured latency risk.

The local verification intentionally ran without OpenAI or PostgreSQL secrets, so it exercised the deterministic grounded explanation and process-memory fallback. Model latency must be measured separately in the target VPS environment before promising a production sub-10-second result.

## Authentication and payment topology

```text
Browser -> AgriSense HTTPS -> bdapps OTP/payment service -> bdapps
                         \-> PostgreSQL account, session, memory, and chat state
                         \-> OpenAI Responses and Realtime APIs
```

`PAYMENT_ADMIN_TOKEN`, bdapps credentials, the database URL, and OpenAI keys are server-only. The vendored payment service is in `services/bdapps-payment/`; its live `.env` from the private handoff ZIP is intentionally excluded from Git.

## Deployment

The production release uses the existing DigitalOcean droplet and same-origin Nginx routes:

- farmer product: `https://rookiecoders.tech/`
- payment backend: `https://rookiecoders.tech/api/bdapps`
- protected payment operations: `https://rookiecoders.tech/payments/`

Run `npm.cmd run check` before deployment. On the VPS, install production dependencies, build the Vite bundle, run the PostgreSQL initialization through server startup, switch the versioned release symlink, restart the service, and verify `/api/health`, `/api/payments/status`, and the landing page. Never run a real debit as a smoke test.

## Evidence

- `docs/tier1/final plan.html` — approved Thinker-to-Executor plan.
- `docs/tier1-validation.md` — Tier 1 test, API, browser, and latency evidence.
- `docs/tier1-defect-ledger.md` — baseline, fix, and retest register.
- `docs/superpowers/specs/2026-07-25-agrisense-authenticated-farmer-agent-design.md` — authenticated Tier 2 product contract.
- `services/bdapps-payment/docs/KOUSHIK_INTEGRATION.md` — payment service integration and operations handoff.
- `currentprogress.md` — current release state and remaining risks.
- `evaluation.html` — original Tier 0 judge-facing acceptance ledger.

Public repository: <https://github.com/I-am-Mr-Rookie/rookieCoders_AgriSense>
