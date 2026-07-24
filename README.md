# Rookie Coders — AgriSense Tier 0

AgriSense is an evidence-backed Bangladesh farm-planning agent for the IUT 12th ICT Fest Bdapps Agentic AI Hackathon.

## What is implemented

- targeted intake for location, farm size, soil, water, budget, and season;
- live seven-day Bangladesh weather from Open-Meteo;
- four Rabi crop recommendations influenced by farm context, weather, finance, and BARC crop-zoning evidence;
- six dated checkpoints from land preparation through harvest;
- cost breakdown, yield, revenue, profit, ROI, and break-even;
- 1,976 indexed fact cards from nine structured public-source datasets;
- retrieved evidence attached to recommendations and plan stages;
- positive-overlap retrieval for meaningful queries, with structured browse preserved for empty queries;
- a deterministic rationale on every crop naming profile, weather, RAG, penalty, and assumption inputs;
- a bounded GPT-5.6 Sol Responses API tool loop with strict allow-listed read tools;
- a sanitized deterministic recovery explanation if that tool loop fails;
- an inspectable, secret-redacted operation trace;
- bounded Bangladesh district validation and truthful persistence-failure messages;
- a fresh-session demo path with accessible status/error feedback and narrow-screen containment;
- PostgreSQL session persistence with an explicitly labeled memory fallback.

## Truth boundaries

| Category | Truth |
|---|---|
| Live | Open-Meteo responses; OpenAI responses when configured; PostgreSQL writes when configured. |
| Retrieved | BARC crop zoning and fertilizer guidance, BAMIS/DAE records, and other supplied structured sources with provenance/confidence fields. |
| Team assumptions | Base crop coefficients, costs, yields, prices, and default checkpoint offsets. |
| Deferred | Tier 1/2, bdapps payments, image diagnosis, marketplace, Bengali voice, proactive alerts. |

The corpus contains partial and cautionary records. Exact agronomic dates and financial assumptions require local expert validation. Chemical pesticide advice is deliberately omitted without current DAE registry evidence.

## Run

Requires Node.js 22+.

```powershell
Copy-Item .env.example .env
npm.cmd ci
npm.cmd run check
npm.cmd start
```

Open <http://localhost:3001>. The canonical entry is a blank farmer conversation; **Start fresh Gazipur demo** creates a new isolated demonstration session on every run.

Environment variables:

```text
OPENAI_API_KEY=server-side-only
OPENAI_MODEL=gpt-5.6-sol
OPENAI_REASONING_EFFORT=high
DATABASE_URL=server-side-only
DATABASE_SSL_REJECT_UNAUTHORIZED=true
APP_REVISION=deployed-git-sha
PORT=3001
```

Never place secret values in Git, the browser client, trace output, screenshots, or model prompts.
Keep database certificate verification enabled. If a controlled DigitalOcean database endpoint presents its documented self-signed chain, the target may explicitly set `DATABASE_SSL_REJECT_UNAUTHORIZED=false`; the override is never automatic.

## Verified locally

Verified Tier 0 release on 24 July 2026:

- `npm.cmd run check`: 68/68 tests passed and the production build passed;
- validation/recovery probes cover canonical Bangladesh districts, strict decimal bounds, save-before-dependency state, distinct initial-save/downstream failures, and bounded logs;
- grounding probes cover positive-score retrieval, four-crop rationales, preserved ranking arithmetic, and secret-safe deterministic model recovery;
- judge-path probes cover fresh session IDs, reset semantics, honest/accessible status, financial assumption labels, mojibake, and responsive CSS contracts;
- `/api/health`: `Tier-0`, nine datasets, 1,976 indexed fact cards;
- complete Gazipur HTTP flow: four crops, six checkpoints, six citations, live Open-Meteo, and visible trace;
- bounded live `gpt-5.6-sol`/medium probe: the model selected all five evidence-inspection tools and returned a grounded explanation;
- instruction-like retrieval text remained inert data;
- unknown/repeated model tool calls were rejected and secret-shaped trace fields were redacted.

The main local HTTP probe intentionally ran without secrets, so it exercised the labeled deterministic explanation and memory fallback. A separate transient server-side probe verified the live GPT-5.6 Sol tool loop without exposing the key.

The hardened release is deployed at <https://rookiecoders.tech>. The release process verified that GitHub `origin/main`, the Droplet checkout, PM2's `APP_REVISION`, and public `/api/health.releaseRevision` matched. A partial PostgreSQL session survived restart and completed with four crops, six checkpoints, all eight finance fields, cited rationales, live Open-Meteo data, and all five model-selected evidence tools. Chrome and visible Computer Use verified the judge path; 320/360/375 px checks found no horizontal overflow.

## Evidence artifacts

- `evaluation.html` — offline judge-facing acceptance ledger and conservative self-score.
- `currentprogress.md` — exact implementation state and remaining gates.
- `docs/tier0-defect-ledger.md` — deduplicated baseline/fix/retest register.
- `final plan.html` — validated Thinker-to-Executor handoff.
- `next-session-prompt.md` — re-engineered execution contract.

## DigitalOcean

```bash
git clone https://github.com/I-am-Mr-Rookie/rookieCoders_AgriSense.git
cd rookieCoders_AgriSense
npm ci
npm run check
npm run build
pm2 start server/index.js --name agrisense
pm2 save
```

Keep OpenAI and database credentials in the Droplet environment, point the existing Nginx/HTTPS route to port `3001`, then verify `/api/health` and one full blank-to-plan flow.

Public repository: <https://github.com/I-am-Mr-Rookie/rookieCoders_AgriSense>
