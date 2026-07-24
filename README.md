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
- a bounded GPT-5.6 Sol Responses API tool loop with strict allow-listed read tools;
- an inspectable, secret-redacted operation trace;
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

Open <http://localhost:3001>. The canonical entry is a blank farmer conversation; **Run Gazipur demo** is only a rapid demonstration fixture.

Environment variables:

```text
OPENAI_API_KEY=server-side-only
OPENAI_MODEL=gpt-5.6-sol
OPENAI_REASONING_EFFORT=high
DATABASE_URL=server-side-only
DATABASE_SSL_REJECT_UNAUTHORIZED=true
PORT=3001
```

Never place secret values in Git, the browser client, trace output, screenshots, or model prompts.
Keep database certificate verification enabled. If a controlled DigitalOcean database endpoint presents its documented self-signed chain, the target may explicitly set `DATABASE_SSL_REJECT_UNAUTHORIZED=false`; the override is never automatic.

## Verified locally

On 24 July 2026:

- `npm.cmd run check`: 15/15 tests passed and the production build passed;
- `/api/health`: `Tier-0`, nine datasets, 1,976 indexed fact cards;
- complete Gazipur HTTP flow: four crops, six checkpoints, six citations, live Open-Meteo, and visible trace;
- bounded live `gpt-5.6-sol`/medium probe: the model selected all five evidence-inspection tools and returned a grounded explanation;
- instruction-like retrieval text remained inert data;
- unknown/repeated model tool calls were rejected and secret-shaped trace fields were redacted.

The main local HTTP probe intentionally ran without secrets, so it exercised the labeled deterministic explanation and memory fallback. A separate transient server-side probe verified the live GPT-5.6 Sol tool loop without exposing the key. DigitalOcean and target PostgreSQL still require target-environment verification.

## Evidence artifacts

- `evaluation.html` — offline judge-facing acceptance ledger and conservative self-score.
- `currentprogress.md` — exact implementation state and remaining gates.
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
