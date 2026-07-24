# AgriSense Tier 0 95% Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reach at least 95/100 on the frozen Executor readiness rubric with tested Tier 0 correctness, recovery, browser reliability, clean deployment, and truthful evidence before 2026-07-25 00:00 Asia/Dhaka.

**Architecture:** Preserve the deterministic weather/RAG/ranking/finance pipeline and bounded Sol inspection loop. Add validation and recovery boundaries before external work, enrich deterministic recommendation evidence, repair judge-path state/responsiveness, expose a non-secret release revision, then prove the exact release through local, clean-clone, production, restart, browser, and secret gates.

**Tech Stack:** Node.js 22, Express 5, React 19, Vite 7, Node test runner, OpenAI Responses API, Open-Meteo, PostgreSQL, PM2, Nginx, DigitalOcean.

---

## Frozen Score and Deadline

| Criterion | Target |
|---|---:|
| Official functional and contract correctness | 34/35 |
| Critical edge, failure, and concurrency behavior | 17/20 |
| Regression and demo-path reliability | 15/15 |
| Clean setup and target reproducibility | 15/15 |
| Submission, secrets, documentation, and Git integrity | 10/10 |
| Maintainability | 4/5 |
| **Total** | **95/100** |

- Normal implementation: 22:30–23:25.
- Freeze and independent review: 23:25–23:43.
- Deploy and target verification: 23:43–23:55.
- Final evidence and hard stop: 23:55–00:00.

## Executed Evidence

| Task | Commits | Current evidence |
|---|---|---|
| Input validation and retry truth | `669571d`, `584810f`, `0db6300`, `773550b` | RED failures reproduced; strict-district quality re-review approved |
| Grounded retrieval and recovery | `7d58506`, `f33aa88` | Focused and Unicode lexical checks passed; Task 2/3 spec and quality reviews approved |
| Judge-path state and layout | `9e416b3` | 9 focused checks; final merged `npm.cmd run check` passed 58 tests and the Vite build |
| Release identity | `9eac23c` | 2 revision checks passed; final target SHA proof remains a release gate |

### Task 1: Validate farm input and preserve retryable state

**Files:**
- Create: `server/validation.js`
- Create: `tests/validation.test.js`
- Modify: `server/index.js`

- [x] **Step 1: Write failing validation tests**

Test a complete Gazipur/Rabi profile, partial patches, non-Bangladesh locations, zero/negative/oversized farm sizes and budgets, unsupported soil/water values, unsupported seasons, and unknown fields. Expected contract: partial patches may omit fields; supplied values must be normalized or rejected with a controlled validation error and no secret/provider detail.

- [x] **Step 2: Run RED**

Run: `node --test tests/validation.test.js`

Expected: module-not-found for `server/validation.js`.

- [x] **Step 3: Implement the minimal validator**

Export:

```js
export class ValidationError extends Error {}
export function validateProfilePatch(patch) {}
export function publicFailure(errorId) {
  return {
    error: "AgriSense could not complete this step. Your saved farm details are safe; please retry.",
    errorId,
    phase: "Tier-0",
    recoverable: true,
  };
}
```

Allow only `location`, `farmSizeAcres`, `soilType`, `waterAvailability`, `budgetBdt`, and `targetSeason`. Accept Bangladesh district-style locations, farm size `(0, 100]`, budget `(0, 100000000]`, supported soil/water strings, and `Rabi`. Reject non-finite numbers and unknown fields.

- [x] **Step 4: Integrate state and error boundaries**

Validate the extracted or supplied patch before merging. Save the merged profile before weather/model work so a dependency failure can be retried without losing the latest intake. Return `400` for validation failures and a sanitized `502` payload with an opaque error ID for dependency failures; log the internal message server-side without returning it.

- [x] **Step 5: Run GREEN and regression**

Run: `node --test tests/validation.test.js && npm.cmd test`

Expected: all tests pass.

### Task 2: Make retrieval and explanations contract-complete

**Files:**
- Modify: `server/rag.js`
- Modify: `server/core.js`
- Modify: `server/openai.js`
- Modify: `tests/rag.test.js`
- Modify: `tests/core.test.js`
- Create: `tests/openai-recovery.test.js`

- [x] **Step 1: Write failing behavior tests**

Add tests proving:

- irrelevant queries return no zero-score RAG results;
- each ranked crop has a deterministic rationale naming farm size, soil, water, budget, season, live rainfall/temperature, RAG score, penalties, source IDs, and team-assumption finance;
- model failure returns a labeled deterministic recovery explanation rather than failing the whole plan;
- the recovery explanation distinguishes live weather, retrieved evidence, and assumptions.

- [x] **Step 2: Run RED**

Run: `node --test tests/rag.test.js tests/core.test.js tests/openai-recovery.test.js`

Expected: assertions fail because zero-score filtering, per-crop rationales, and model recovery do not yet exist.

- [x] **Step 3: Implement minimal grounding**

Filter `retrieveFacts` to positive scores when a non-empty query is supplied. Add a `rationale` object to every crop without changing ranking arithmetic. Extract one deterministic explanation builder and use it both for no-key mode and caught OpenAI failure. Add one sanitized `agent.model_recovery` trace entry.

- [x] **Step 4: Run GREEN and regression**

Run: `node --test tests/rag.test.js tests/core.test.js tests/openai-recovery.test.js && npm.cmd test`

Expected: all tests pass.

### Task 3: Repair judge-path state, accessibility, and mobile layout

**Files:**
- Create: `src/session.js`
- Create: `tests/session.test.js`
- Modify: `src/App.jsx`
- Modify: `src/styles.css`
- Modify: `tests/ui-contract.test.js`

- [x] **Step 1: Write failing client-contract tests**

Test:

- session ID generation has a fallback when `crypto.randomUUID` is unavailable;
- starting the demo creates a fresh session ID and reset-state contract;
- the source exposes a durable input label, `aria-busy`, polite status, alert errors, honest initial weather text, financial assumption labels, and a fresh-demo handler;
- mobile CSS includes `min-width:0` and a narrow breakpoint that stacks the header/form without horizontal overflow.

- [x] **Step 2: Run RED**

Run: `node --test tests/session.test.js tests/ui-contract.test.js`

Expected: missing module and missing UI/CSS contracts.

- [x] **Step 3: Implement minimal client reliability**

Create a session-ID helper with `crypto.randomUUID` and timestamp/random fallback. Make each demo run use a new session and reset conversation/result/error first. Add accessible status/error/input semantics, change initial weather text to `Weather not fetched`, label financial outputs as team-assumption estimates, and fix 320–375 px overflow.

- [x] **Step 4: Run GREEN and regression**

Run: `node --test tests/session.test.js tests/ui-contract.test.js && npm.cmd run check`

Expected: all tests and production build pass.

### Task 4: Expose release identity and refresh evidence

**Files:**
- Create: `server/revision.js`
- Create: `tests/revision.test.js`
- Modify: `server/index.js`
- Modify: `README.md`
- Modify: `currentprogress.md`
- Modify: `evaluation.html`
- Modify: `next-session-prompt.md`
- Create: `docs/tier0-defect-ledger.md`

- [x] **Step 1: Write failing revision and evidence tests**

Test that the revision helper returns `APP_REVISION` or `unknown`, `/api/health` wiring names `releaseRevision`, the evidence page has no stale “deploy before completion” claim, and documentation uses the final executed test count rather than `15/15`.

- [x] **Step 2: Run RED**

Run: `node --test tests/revision.test.js tests/ui-contract.test.js`

Expected: missing revision module and stale evidence assertions.

- [x] **Step 3: Implement truthful release evidence**

Expose `releaseRevision` in health. Update evidence artifacts with the frozen rubric, before/after findings, exact executed commands, Kawsar screenshot adjudication, limitations, and deferred Tier 1/2 work. The ledger must preserve raw report count, unique confirmed defects, before/after evidence levels, commits, and residual risks.

- [x] **Step 4: Run GREEN and full local gate**

Run: `npm.cmd run check && git diff --check`

Expected: all tests/build pass and no whitespace errors.

### Task 5: Independent review, clean clone, and release

**Files:** no new production files.

- [x] **Step 1: Independent specification review**

Review Tasks 1–4 against this plan and the eight official Tier 0 capabilities. Fix every Critical or Important issue and re-review.

- [x] **Step 2: Independent code-quality review**

Review the approved implementation for correctness, recovery, data boundaries, React behavior, test quality, and accidental scope. Fix every Critical or Important issue and re-review.

- [ ] **Step 3: Fresh-clone gate**

Clone `origin/main` into a new temporary directory after the verified commit exists; run `npm ci`, `npm test`, and `npm run build`. No local dependency cache or untracked source may be required.

- [ ] **Step 4: Release gates**

Scan tracked source and `dist` for secret-shaped values, verify `.env` and credential files are untracked, confirm only `roadmap-t0.html` remains intentionally untracked, push `main`, and verify remote SHA.

- [ ] **Step 5: Deploy exact release**

Fast-forward the preserved Droplet checkout, run `npm ci`, tests, build, set `APP_REVISION` to the release SHA, restart and save PM2, and verify public health reports the same SHA.

- [ ] **Step 6: Target E3/E4 verification**

Run:

- a two-turn vague free-text intake;
- the Gazipur demo;
- invalid-input `400` with sanitized payload;
- partial-session save, PM2 restart, remaining-fields completion;
- model-selected five-tool trace;
- direct Chrome DOM and console check;
- visible Computer Use judge path;
- 320, 360, and 375 px overflow checks.

- [ ] **Step 7: Re-score once**

Score the unchanged six criteria using only executed evidence. Declare 95 only if the sum is at least 95 and every critical Tier 0 requirement has E2–E4 evidence. Otherwise report the exact lower score and blockers without rounding.
