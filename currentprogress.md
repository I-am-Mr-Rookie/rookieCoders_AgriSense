# AgriSense Tier 1 — Current Progress

**As of:** 25 July 2026, Asia/Dhaka

**Repository:** <https://github.com/I-am-Mr-Rookie/rookieCoders_AgriSense>

**Status:** Tier 1 is implemented and locally verified. It is not deployed.

## Executive verdict

The approved A+C scope is complete: explicit persistent farm memory and a fertilizer/irrigation scheduler now sit on top of the validated Tier 0 crop-planning flow. The experience has been converted from a blocking request into a streamed agent workspace with inspectable steps, safe Markdown, theme switching, adaptive reasoning effort, and independent disclosures.

Optional broad proactive alerts were not added. External delivery, image input, Bengali speech, and the real-time voice companion remain Tier 2.

## Delivered

| Requirement | Evidence |
|---|---|
| Persistent memory | High-entropy `farm_` recovery ID, SHA-256-derived storage key, create/resume/update/reset endpoints, UI lifecycle controls, PostgreSQL/process-memory compatibility. |
| Scheduler | Fertilizer and irrigation items with dates, costs, truth labels, confirmation status, and forecast-based irrigation delay. |
| Agent activity | NDJSON stream with stable ordered events, duration metadata, tool/provider/data summaries, and secret redaction. |
| Markdown | `react-markdown` + `remark-gfm`; raw HTML disabled; safe external links. |
| Reasoning | Medium routine default; high only for deterministic difficult-case patterns; only API-provided summaries are displayed. |
| Crop-card bug | Grid cards use start alignment and independent self-sizing. |
| Themes | System/light/dark selector with persisted preference and complete tokens. |
| Latency | Phase measurements plus five-minute normalized-location weather cache and concurrent-request deduplication. |

## Verification

- `npm.cmd run check`: 103 passed, 0 failed; production build passed.
- Health: `Tier-1`, memory/scheduler/activity capabilities true, external notifications false.
- Memory lifecycle: create, resume, and reset passed; recovery credential was not printed.
- Memory isolation: create captured the current plan, resume used a fresh browser session, recovered farm data overrode stale session data, and a fresh demo sent no memory credential.
- Streamed planning: 11 activity events, two schedule items, final plan present.
- Browser: desktop and 390×844 passed with zero console errors and no horizontal overflow; cancel/retry and the process-memory warning were visible.
- Cancellation: client disconnect propagates through weather/model requests; aborts during persistence restore the previous session/memory result.
- Preferences: auto-adjust changes persist immediately, plan/preference mutations are serialized, and resume retains both the latest plan and preference.
- Scheduler reachability: a live forecast rain day triggered the irrigation-adjustment path through an explicit plan start date.
- Card regression: `[248,248,248,248]` before; `[340,248,248,248]` after opening the first card; one disclosure open.
- Theme: dark mode applied and persisted across reload.
- Latency:
  - one Open-Meteo cold attempt hit the seven-second timeout;
  - the next successful uncached flow completed in about 2.2 seconds;
  - the cached flow completed in 87 ms, with 51 ms measured inside the planning workflow.

## Latency diagnosis

The local deterministic RAG/ranking/scheduler/response path is not the source of the reported 20–30 second wait. The measured risks are:

1. cold geocoding and forecast network calls;
2. model-provider response and tool-loop duration when `OPENAI_API_KEY` is enabled;
3. VPS CPU contention, memory pressure, DNS/TLS latency, and distance to providers;
4. proxy buffering if Nginx is not configured to pass NDJSON immediately.

The UI now makes the delay visible and useful even when the total cannot be reduced. A production sub-10-second claim still requires measurements on the target VPS with the real model and proxy path.

## Safety boundaries

- No raw chain-of-thought is requested or rendered.
- Recovery IDs are bearer credentials and are redacted from activities and traces.
- Fertilizer actions require farmer confirmation.
- Chemical recommendations remain prohibited without current official registry evidence.
- Costs, yields, prices, and default stage dates remain labeled team assumptions.

## Not performed

- no production deployment;
- no VPS resize or billing/account change;
- no external alert delivery;
- no image diagnosis;
- no Bengali speech or voice assistant;
- no chemical recommendation expansion.
