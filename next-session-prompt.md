# Re-engineered Prompt - AgriSense Tier 0 Release Closure

## Role Stack

- **Primary role:** AgriSense Tier 0 Implementation and Delivery Lead accountable for a deployed, judge-auditable core.
- **Prompt-design role:** Agent Workflow and Prompt Repair Engineer responsible for the bounded OpenAI tool loop and evidence contract.
- **Platform role:** React/Vite, Express/Node, OpenAI Responses API, PostgreSQL, DigitalOcean, and in-process RAG Engineer.
- **Validation role:** Official-Contract, Regression, Demo, Secret-Safety, and Release Auditor.

## Objective

Close and verify the hardened AgriSense Tier 0 release candidate. Preserve the implemented vertical slice, structured RAG, deterministic validation/ranking/finance, bounded GPT-5.6 Sol tool loop, deterministic recovery, and fresh judge path. Finish only evidence-backed Critical/Important defects, run the complete release gate, deploy the exact tested revision to the existing DigitalOcean target, and push/verify that same revision on GitHub.

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
- Current merged candidate: 58/58 tests and the Vite production build pass after the Unicode retrieval follow-up.
- Independent Task 1 specification/quality review and Task 2/3 specification review passed; the final Task 2 quality follow-up must be rechecked.
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

1. Recheck the last independent review finding and fix only Critical/Important defects with RED/GREEN evidence.
2. Freeze the candidate with `npm.cmd run check`, `git diff --check`, tracked-secret scanning, and a clean working tree except the intentionally untracked roadmap.
3. Commit and push the exact candidate, verify the remote SHA, then clone it into a fresh directory and run `npm.cmd ci`, tests, and build.
4. Fast-forward the preserved DigitalOcean checkout, install, test, build, set `APP_REVISION` to the exact commit, restart/save PM2, and read the same SHA from public health.
5. Run public invalid-input, partial-save/restart/complete, Gazipur plan, model-tool-trace, and sanitized-error probes.
6. Use the explicitly authorized Chrome extension control plus visible Computer Use to verify DOM content, console cleanliness, and the judge path; use no Playwright.
7. Prove `scrollWidth <= clientWidth` at 320, 360, and 375 px.
8. Update the defect ledger and score the frozen rubric once. Claim 95 only if the evidence sum is at least 95; otherwise publish the lower score and exact blockers.

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
