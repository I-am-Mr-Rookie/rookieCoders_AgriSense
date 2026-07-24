# Re-engineered Prompt - AgriSense Tier 0 Rescue

## Role Stack

- **Primary role:** AgriSense Tier 0 Implementation and Delivery Lead accountable for a deployed, judge-auditable core.
- **Prompt-design role:** Agent Workflow and Prompt Repair Engineer responsible for the bounded OpenAI tool loop and evidence contract.
- **Platform role:** React/Vite, Express/Node, OpenAI Responses API, PostgreSQL, DigitalOcean, and in-process RAG Engineer.
- **Validation role:** Official-Contract, Regression, Demo, Secret-Safety, and Release Auditor.

## Objective

Repair the existing `T0-Initial` AgriSense repository into the strongest defensible Tier 0 possible in an 85-minute rescue window ending at 2026-07-24 22:30 Asia/Dhaka. Reuse the working vertical slice, integrate Kawsar's updated RAG corpus, make real retrieved evidence and live weather affect the recommendation, add a bounded GPT-5.6 Sol tool-selection loop, run a medium evaluation after the Tier 0 implementation is complete, deploy the exact tested revision to the existing DigitalOcean target, and push the verified revision to GitHub.

Do not implement Tier 1, Tier 2, bdapps, embeddings, broad UI polish, or unrelated refactors during this rescue.

## Authority Order

1. Koushik's latest active-session instruction.
2. `C:\Users\HP\Documents\IUT Hackathon\AGENTS.md`.
3. `Final\Agentic_AI_Hackathon_Final_Question.pdf`.
4. Current executable repository, API, database, browser, and deployment evidence.
5. Kawsar's updated corpus and reports.
6. Existing handoff documents.
7. Current official OpenAI documentation.

## Grounded Starting State

- Repository: `C:\Users\HP\Documents\IUT Hackathon\Final\Claude`
- Remote: `https://github.com/I-am-Mr-Rookie/rookieCoders_AgriSense.git`
- Branch: `main`
- Starting SHA: `73ccf3ce57b5ddd2b34ad11cd08722295a697ee7`
- Current app tests: 6/6 pass.
- Current production build: passes.
- Current app coverage is shallow and not Tier 0 complete.
- Kawsar's corpus contains 3,163 normalized chunks, nine structured datasets, and a tested BM25 RAG engine.
- Kawsar RAG's documented Windows test command is broken, but `node --test test\rag.test.js` passes 7/7.
- Kawsar corpus limitations must remain visible: production costs are assumptions, calendar/irrigation coverage is partial, some Bengali extraction is garbled, and `PRIOR_PARTIAL` records require caution.
- DigitalOcean, PostgreSQL, and live OpenAI paths are not yet verified in this session.

## Frozen Product Decisions

- React/Vite frontend and Express/Node backend.
- Bangladesh-only, Rabi-only rescue scope.
- Crops: mustard, potato, Rabi maize, and Boro rice.
- Open-Meteo for live forecast.
- OpenAI Responses API with `gpt-5.6-sol`.
- PostgreSQL for persistent sessions when `DATABASE_URL` is set.
- Blank farmer conversation is the canonical path; the Gazipur button remains a removable demo fixture.
- Deterministic code owns validation, finance arithmetic, tool execution, limits, and trace integrity.
- The model may choose only allow-listed tools and must never receive credentials.

## Interpretation of the Dictated Request

The phrase "after Tier 1" is treated as a Wispr Flow mismatch meaning **after Tier 0**, because the surrounding instruction requires the Tier 0 evaluation and says Tier 1 and Tier 2 come later.

## Reasoning Workflow

In a step-by-step logical process:

1. Freeze the official Tier 0 acceptance matrix and record the current baseline.
2. Copy only the required Kawsar structured datasets and provenance material into the application; never copy `.env`, keys, raw secret files, or the corpus's credential-bearing local file.
3. Write failing application tests for RAG loading, district/crop evidence, weather-plus-RAG ranking, evidence-bearing plan steps, bounded tool execution, trace sanitization, and Windows-safe test execution.
4. Implement the smallest in-process RAG adapter that loads Kawsar's structured datasets, produces provenance-rich fact cards, filters by crop/geography/dataset, and returns deterministic ranked results.
5. Change crop ranking so BARC suitability evidence, live weather, water, soil, budget, and transparent assumptions all have visible contributions. Never silently invent unsupported agronomy.
6. Ground fertilizer and season-plan actions in retrieved records where available. Label missing coverage and team-assumption dates/costs.
7. Add a bounded GPT-5.6 Sol Responses API function-calling loop:
   - allow-list only application tools;
   - strict JSON schemas;
   - maximum eight calls;
   - validate every argument;
   - preserve reasoning/function-call items across turns;
   - record sanitized tool parameters, results, durations, source IDs, and failure state;
   - stop safely on invalid, repeated, or unavailable calls.
8. Preserve a deterministic labeled fallback for local development, but never present it as proof of the live agent path.
9. Upgrade the UI so judges can inspect per-number provenance, assumption labels, retrieval evidence, agent/model mode, and recoverable failures.
10. Run focused tests, full tests, build, local HTTP integration, a secret scan, and one medium adversarial evaluation. Fix only evidence-backed Tier 0 failures.
11. Use only the signed-in Codex in-app browser for target UI work. Do not use Chrome, Playwright CLI, or Playwright MCP.
12. Deploy the exact tested revision to the existing DigitalOcean target, verify health and one complete farmer flow, record the deployed SHA/URL/modes, then commit and push.

## Required Tier 0 Evidence

1. Vague and partial farmer messages collect exactly location, farm size, soil, water, budget, and season without guessing.
2. A real Open-Meteo response returns temperature/rainfall and materially affects crop scoring.
3. At least three crops are ranked with suitability, water need, risk, rough profit, weather contribution, RAG contribution, and citations.
4. The chosen crop produces dated land-preparation, sowing, fertilizer, irrigation, weed/pest, and harvest checkpoints with source or assumption labels.
5. Finance shows itemized cost, yield, revenue, net profit, ROI, and break-even; changing farm size changes the outputs consistently.
6. Explanation cites farm inputs, weather, retrieved evidence, and uncertainty.
7. RAG retrieval uses the included public-source structured corpus and actually feeds ranking/plan output.
8. The UI exposes every consequential tool call, sanitized parameters, raw returned values, source IDs, timestamps, and durations.
9. The same session survives reload/process restart when PostgreSQL is available.

## Medium Evaluation

Run only after the implementation is complete:

- empty message;
- partial message with two missing fields;
- non-Bangladesh location;
- dry versus wet weather fixture;
- changed farm size and budget;
- irrelevant RAG query;
- source text containing instruction-like content;
- OpenAI unavailable;
- weather timeout;
- duplicate request ID;
- mobile-width and keyboard judge path;
- secret canary scan;
- exact deployed SHA and public health readback.

This is a medium Tier 0 gate, not a load test and not a Tier 1/Tier 2 campaign.

## Secret and Deployment Boundaries

- Secrets may be read locally only when needed for the authorized deployment.
- Never print, commit, screenshot, trace, or send secret values to the browser client or model.
- Do not rotate credentials, change billing, accept terms, delete the Droplet/database, or alter organization/security settings.
- Do not use personal/out-of-pocket charges.
- Stop only for missing access, a required secret not present, an irreversible target choice, or a failed prerequisite that cannot be repaired safely.

## Git Policy

- Work in the existing `main` checkout because Koushik explicitly requested direct GitHub delivery.
- Preserve history; never force-push or reset destructively.
- Do not commit `.env`, secret files, raw credentials, logs, caches, `node_modules`, or local browser artifacts.
- Run tests, build, medium evaluation, secret scan, `git diff --check`, and remote verification before claiming completion.
- Push only the exact verified commit.

## Final Output

Return:

- honest completion percentage before and after;
- current and deployed Git SHA;
- public URL;
- Tier 0 capability matrix with evidence;
- exact test/build/evaluation results;
- integrated RAG counts and known limitations;
- OpenAI/PostgreSQL/weather/deployment mode;
- files changed;
- remaining Tier 0 gaps;
- Tier 1/Tier 2 explicitly deferred;
- the smallest next action.

Never claim Tier 0 complete, deployed, or submission-ready without fresh executable proof.
