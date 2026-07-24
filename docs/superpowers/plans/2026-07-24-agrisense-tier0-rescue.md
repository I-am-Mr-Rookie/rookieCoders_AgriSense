# AgriSense Tier 0 Rescue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the existing T0-Initial app into a verified, deployed, judge-auditable Tier 0 rescue without beginning Tier 1 or Tier 2.

**Architecture:** Keep React/Vite and Express/Node. Add an in-process structured-data RAG adapter, use its BARC evidence as an explicit crop-score contribution, ground plan steps in retrieved records, and let GPT-5.6 Sol choose from a bounded set of deterministic server tools. PostgreSQL remains the persistent session store and the UI exposes the sanitized execution trace.

**Tech Stack:** Node.js 24, Express 5, React 19, Vite 7, OpenAI Responses API, PostgreSQL, Open-Meteo, Node test runner.

---

### Task 1: Import Kawsar's safe structured corpus

**Files:**
- Create: `data/structured/*.json`
- Create: `data/corpus-metadata.json`
- Test: `tests/rag.test.js`

- [ ] **Step 1: Write the failing corpus test**

Assert that the loader finds all nine datasets, indexes more than 1,900 fact cards, excludes blocked rows, and returns provenance for a Gazipur mustard suitability query.

- [ ] **Step 2: Run the test to verify RED**

Run: `node --test tests/rag.test.js`

Expected: FAIL because `server/rag.js` and `data/structured` do not exist.

- [ ] **Step 3: Copy only structured JSON and write the loader**

Copy the nine files from Kawsar's ZIP. Implement `loadCorpus()`, `retrieveFacts()`, `getCropSuitabilityEvidence()`, and provenance shaping in `server/rag.js`. Do not copy any `.env`, secret, raw PDF, binary, or generated embedding index.

- [ ] **Step 4: Run the test to verify GREEN**

Run: `node --test tests/rag.test.js`

Expected: PASS with nine datasets and provenance-rich results.

### Task 2: Make RAG evidence affect rankings and plans

**Files:**
- Modify: `server/core.js`
- Modify: `server/index.js`
- Test: `tests/core.test.js`

- [ ] **Step 1: Add failing behavior tests**

Add tests proving that a BARC suitability contribution changes a crop's score, every ranked crop carries score components and citations, and season-plan steps carry either a source ID or a `TEAM_ASSUMPTION` label.

- [ ] **Step 2: Run focused tests to verify RED**

Run: `node --test tests/core.test.js`

Expected: FAIL on missing evidence arguments and grounding fields.

- [ ] **Step 3: Implement the smallest evidence-aware calculation**

Accept `evidenceByCrop` in `rankCrops()`, expose weather/RAG/soil/water/budget components, and attach citations. Accept retrieved fertilizer/calendar/irrigation/pest/yield facts in `buildSeasonPlan()` and label unsupported dates/costs.

- [ ] **Step 4: Run focused tests to verify GREEN**

Run: `node --test tests/core.test.js`

Expected: PASS.

### Task 3: Add bounded Sol tool selection

**Files:**
- Create: `server/agent.js`
- Modify: `server/openai.js`
- Modify: `server/index.js`
- Test: `tests/agent.test.js`

- [ ] **Step 1: Write failing fake-client tool-loop tests**

Cover allow-listed tool dispatch, strict arguments, reasoning/function-call round trips, repeated-call rejection, eight-call maximum, and secret redaction.

- [ ] **Step 2: Run tests to verify RED**

Run: `node --test tests/agent.test.js`

Expected: FAIL because `server/agent.js` does not exist.

- [ ] **Step 3: Implement the bounded loop**

Use Responses API function tools and preserve response output items between calls. Execute only registered local handlers. Return an evidence-bound final answer and sanitized trace. Use the existing deterministic flow only when the key is absent, and label it.

- [ ] **Step 4: Run tests to verify GREEN**

Run: `node --test tests/agent.test.js`

Expected: PASS.

### Task 4: Expose judge-auditable evidence

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/styles.css`
- Test: `tests/http.test.js`

- [ ] **Step 1: Add failing HTTP assertions**

Assert that a seeded request returns RAG mode/count, score components, citations, assumption labels, trace mode, and a stable recoverable error shape.

- [ ] **Step 2: Run tests to verify RED**

Run: `node --test tests/http.test.js`

Expected: FAIL on missing response fields.

- [ ] **Step 3: Implement response and UI changes**

Render agent mode, RAG index count, score breakdown, retrieved evidence, assumption badges, cost breakdown, and sanitized trace. Keep the blank conversation canonical.

- [ ] **Step 4: Run tests to verify GREEN**

Run: `node --test tests/http.test.js`

Expected: PASS.

### Task 5: Medium evaluation and release

**Files:**
- Modify: `README.md`
- Modify: `currentprogress.md`
- Create: `docs/tier0-evaluation.md`

- [ ] **Step 1: Run the full local gate**

Run: `npm.cmd run check`

Expected: all tests pass and Vite build exits 0.

- [ ] **Step 2: Run HTTP and adversarial probes**

Exercise partial intake, dry/wet ranking, changed farm size/budget, irrelevant RAG query, external failure, duplicate request, and secret canary. Record exact results in `docs/tier0-evaluation.md`.

- [ ] **Step 3: Verify with the Codex in-app browser**

Check the blank farmer journey, citations, assumptions, trace, recoverable error, and mobile layout. Do not use Chrome or Playwright.

- [ ] **Step 4: Deploy and verify**

Deploy the exact tested SHA to DigitalOcean, set server-only environment variables, run migrations/startup, verify public `/api/health`, complete one farmer flow, restart, and verify session persistence.

- [ ] **Step 5: Release**

Run a secret scan, `git diff --check`, inspect status/diff, commit to `main`, push, and verify the remote SHA matches the intended revision.
