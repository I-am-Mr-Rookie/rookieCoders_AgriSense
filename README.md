# Rookie Coders — AgriSense

`T0-RAG` is the evidence-grounded Tier-0 path for the IUT 12th ICT Fest Bdapps Agentic AI Hackathon. It bundles the validated 3,163-chunk Bangladesh/Rabi corpus, prefers PostgreSQL full-text retrieval, and retains a restart-safe lexical fallback without falsely claiming semantic search.

## Current capability truth

| Capability | Tier | Current truth |
|---|---|---|
| Conversational intake | T0-Initial | GPT-5.6 Sol extracts supplied farm fields; the server asks only for remaining fields. The seeded demo bypasses extraction for a rapid preview. |
| Live weather | T0-Initial | Real Open-Meteo geocoding and seven-day forecast for Bangladesh; returned rainfall and temperature feed crop scores. |
| Crop recommendation | T0-Initial | Four Rabi candidates ranked deterministically using farm, weather, budget and water inputs. Coefficients are provisional demo assumptions. |
| Season plan | T0-Initial | Dated land preparation, sowing, fertilizer, irrigation, weed/pest and harvest checkpoints. Dates require full validation. |
| Financial projection | T0-Initial | Itemized costs, yield, revenue, profit, ROI and break-even calculated in code and scaled with farm size. Prices/yields are seeded assumptions. |
| Explained reasoning | T0-Initial | GPT-5.6 Sol/high uses supplied evidence when `OPENAI_API_KEY` exists; otherwise a deterministic fallback is labeled. |
| Knowledge retrieval | T0-RAG | PostgreSQL full-text or bundled lexical retrieval over 3,163 provenance-rich chunks, with Bangladesh/Rabi/crop/geography/lane filters, stable IDs, scores, direct citations, and quality flags. Semantic retrieval is explicitly unavailable until pgvector and an official embedding model are verified. |
| Visible trace | T0-Initial | UI exposes operations, parameters, returned values, timestamps and durations. |
| Memory | T0-Initial | PostgreSQL persistence with `DATABASE_URL`; in-memory fallback for local development. |

## Real versus generated

- **REAL:** Open-Meteo responses, timestamps, tool parameters, OpenAI responses when configured, and PostgreSQL writes when configured.
- **DETERMINISTIC ASSUMPTIONS:** crop coefficients, seeded costs, yields, prices and calendar templates.
- **GENERATED:** GPT-5.6 Sol explanation.
- **NOT COMPLETE:** full agronomic validation, production RAG ingestion, Sol-directed tool selection, DigitalOcean verification and full Tier 0 regressions.

## Run locally

Requires Node.js 22+.

```powershell
Copy-Item .env.example .env
npm.cmd install
npm.cmd run build
npm.cmd start
```

Open `http://localhost:3001`. Development mode: `npm.cmd run dev`.

## DigitalOcean handoff

Kawsar owns the Droplet, PostgreSQL connection and deployment.

```bash
git clone https://github.com/I-am-Mr-Rookie/rookieCoders_AgriSense.git
cd rookieCoders_AgriSense
npm ci
npm run check
npm run build
export OPENAI_API_KEY='set-on-server'
export OPENAI_MODEL='gpt-5.6-sol'
export OPENAI_REASONING_EFFORT='high'
export DATABASE_URL='set-on-server'
pm2 start server/index.js --name agrisense
pm2 save
```

Point the existing Nginx/HTTPS route to port `3001`, then verify `https://YOUR_HOST/api/health`.

## Verification executed locally

`npm test`, `npm run build`, `/api/health`, and a complete seeded HTTP request using live Open-Meteo. OpenAI and DigitalOcean/PostgreSQL paths still require target-environment verification.

## Rapid judge demo

1. Show the blank conversation as the standard start.
2. Click **Run Gazipur demo** for the rapid preview.
3. Show live weather, four crops, finance, six checkpoints, citations and raw trace.
4. State that this is `T0-Initial`, not completed Tier 0.

Public repository: <https://github.com/I-am-Mr-Rookie/rookieCoders_AgriSense>

## Tier-0 RAG verification

```bash
node --test tests/*.test.js
node scripts/verify-demo.js
npm run ingest:rag
npm run build
```

Run ingestion twice; the second result must report 3,163 parsed/stored rows, zero inserted/updated rows, and 3,163 unchanged rows. See `docs/rag-architecture.md`, `docs/rag-evaluation.md`, `docs/gazipur-demo-evidence.json`, and `docs/deployment-rollback.md`. Target PostgreSQL, OpenAI, PM2, Nginx, HTTPS, and browser claims require execution on Kawsar's existing Droplet and must not be inferred from local inspection.
