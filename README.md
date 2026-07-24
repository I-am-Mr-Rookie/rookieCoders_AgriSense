# Rookie Coders — AgriSense Tier 1

AgriSense is an evidence-backed Bangladesh farm-planning agent for the IUT 12th ICT Fest Bdapps Agentic AI Hackathon.

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
- a five-minute Open-Meteo cache with in-flight deduplication for repeated normalized locations.

## Safety and truth boundaries

| Category | Boundary |
|---|---|
| Live | Open-Meteo responses; OpenAI responses when configured; PostgreSQL writes when configured. |
| Retrieved | BARC crop zoning and fertilizer guidance, BAMIS/DAE records, and supplied structured sources with provenance/confidence fields. |
| Team assumptions | Base crop coefficients, costs, yields, prices, and default checkpoint offsets. |
| Farmer confirmation | Fertilizer operations are never presented as automatically applied. |
| Chemicals | No chemical recommendation is made without current official registry evidence. |
| Memory | The `farm_...` recovery code is a bearer credential. It is hashed before storage and redacted from activity, traces, logs, and model context. |
| Deferred | External alerts/delivery, image diagnosis, Bengali speech, and conversational voice are Tier 2. |

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
OPENAI_MODEL=gpt-5.6-sol
OPENAI_REASONING_EFFORT=auto
DATABASE_URL=server-side-only
DATABASE_SSL_REJECT_UNAUTHORIZED=true
APP_REVISION=git-revision
PORT=3001
```

Never place secrets in Git, the browser client, activity output, screenshots, or model prompts. Keep database certificate verification enabled.

## Tier 1 local verification

Verified locally on 25 July 2026:

- `npm.cmd run check`: 103/103 tests passed and the Vite production build passed;
- memory create/resume/reset API lifecycle passed without printing the recovery credential;
- streamed planning returned 11 ordered activity events, two schedule items, and a final four-crop plan;
- desktop and 390×844 browser checks found zero console errors and no horizontal overflow;
- crop-card regression: opening the first card changed card heights from `[248,248,248,248]` to `[340,248,248,248]`, with exactly one disclosure open;
- dark mode applied immediately and survived reload;
- successful cold weather + deterministic planning completed in about 2.2 seconds during the measured run;
- a cached run completed in 87 ms end-to-end;
- one preceding cold Open-Meteo attempt reached its seven-second network timeout, identifying external network reliability as the main measured latency risk.

The local verification intentionally ran without OpenAI or PostgreSQL secrets, so it exercised the deterministic grounded explanation and process-memory fallback. Model latency must be measured separately in the target VPS environment before promising a production sub-10-second result.

No VPS resize, production deployment, billing change, or external notification delivery was performed for Tier 1.

## Evidence

- `docs/tier1/final plan.html` — approved Thinker-to-Executor plan.
- `docs/tier1-validation.md` — Tier 1 test, API, browser, and latency evidence.
- `docs/tier1-defect-ledger.md` — baseline, fix, and retest register.
- `currentprogress.md` — current release state and remaining risks.
- `evaluation.html` — original Tier 0 judge-facing acceptance ledger.

Public repository: <https://github.com/I-am-Mr-Rookie/rookieCoders_AgriSense>
