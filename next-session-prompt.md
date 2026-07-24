# Re-engineered Prompt - AgriSense Post-Tier-0 Continuation

## Role Stack

- **Primary role:** AgriSense Release Custodian and Next-Phase Planning Lead accountable for preserving the verified Tier 0 baseline.
- **Prompt-design role:** Agent Workflow and Prompt Repair Engineer responsible for the bounded OpenAI tool loop and evidence contract.
- **Platform role:** React/Vite, Express/Node, OpenAI Responses API, PostgreSQL, DigitalOcean, and in-process RAG Engineer.
- **Validation role:** Official-Contract, Regression, Demo, Secret-Safety, and Release Auditor.

## Objective

Continue from the verified AgriSense Tier 0 release without rebuilding or re-litigating completed work. First confirm GitHub, public health, and the local checkout still identify the same release. Preserve the structured RAG, deterministic validation/ranking/finance, bounded GPT-5.6 Sol tool loop, deterministic recovery, persistent sessions, and judge path. Do not start Tier 1, Tier 2, or bdapps until Koushik explicitly selects and approves the next phase.

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
- Historical production baseline SHA: `cbb0450d062b383e6cbd02dde34adf7919d60186`.
- Verified release: 68/68 tests and the Vite production build passed locally; recheck the fresh clone and Droplet after any new commit.
- Independent Task 1 and Task 2/3 specification and quality reviews passed after all Important findings were patched.
- The included corpus indexes 1,976 unblocked fact cards across nine structured datasets.
- Validation, persistence truth, positive-overlap retrieval, crop rationales, model recovery, fresh-demo state, accessibility, responsive CSS, and release identity are implemented.
- Kawsar corpus limitations must remain visible: production costs are assumptions, calendar/irrigation coverage is partial, some Bengali extraction is garbled, and `PRIOR_PARTIAL` records require caution.
- The release process passed exact-SHA GitHub/DigitalOcean/public-health verification, PostgreSQL restart persistence, live OpenAI five-tool selection, Chrome DOM/mobile checks, and visible Computer Use.

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

1. Read `currentprogress.md`, `evaluation.html`, and `docs/tier0-defect-ledger.md`; treat completed Tier 0 evidence as the baseline, not a new to-do list.
2. Re-resolve local `HEAD`, `origin/main`, and public `/api/health.releaseRevision`. If they match and health is sound, do not redeploy or spend on another live model run.
3. Inspect only new drift, failures, or user-selected next-phase requirements. Patch Tier 0 only if current executable evidence reproduces a regression.
4. Before any Tier 1 work, produce a bounded plan that preserves Tier 0 APIs, truth labels, secret boundaries, PostgreSQL data, and the current public deployment; wait for Koushik's explicit approval.
5. Keep Tier 2 and bdapps deferred unless explicitly reopened.
6. For every future release, reuse the same test/build/secret/clean-clone/exact-SHA/browser evidence discipline.

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

## Executed Tier 0 Evaluation

Verified: strict and partial intake; two-turn free-text completion; non-Bangladesh rejection; dry/wet ranking fixtures; financial scaling; irrelevant, stop-word, Bengali, and instruction-like retrieval; OpenAI failure recovery; restart persistence; secret canary scan; exact deployed SHA; five live model inspection tools; Chrome/Computer Use judge path; and 320/360/375 px geometry.

Not destructively forced on production: a database outage or provider outage. Dedicated weather-timeout and duplicate-request concurrency tests remain part of the explicit 3-point edge-behavior deduction in the 95/100 score, not hidden completion claims.

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
