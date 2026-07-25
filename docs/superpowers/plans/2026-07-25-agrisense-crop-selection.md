# AgriSense Crop Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Present four model-authored grounded crop options first and generate a full persistent plan only after the farmer selects one.

**Architecture:** Split the existing planning workflow into candidate analysis and selected-crop planning actions. Keep ranking and arithmetic deterministic, ask OpenAI for strict candidate briefs, persist the candidate/selection state through the existing session and memory services, and render the selection inside chat before exposing full result panels.

**Tech Stack:** Node.js, Express, OpenAI Responses API structured outputs, PostgreSQL JSONB session storage, React 19, Vite, Node test runner.

---

### Task 1: Candidate financial contract

**Files:**
- Modify: `server/core.js`
- Test: `tests/core.test.js`

- [ ] Add a failing test asserting that each ranked crop exposes `costPerAcreBdt`, `fullFarmCostBdt`, `budgetGapBdt`, `plannedAreaAcres`, and `plannedCostBdt` without changing `profile.farmSizeAcres` or `profile.budgetBdt`.
- [ ] Run `node --test tests/core.test.js` and verify the new assertion fails.
- [ ] Derive `plannedAreaAcres = Math.min(profile.farmSizeAcres, profile.budgetBdt / costPerAcreBdt)` and round only for display, not intermediate arithmetic.
- [ ] Re-run `node --test tests/core.test.js` and verify it passes.

### Task 2: Model-authored candidate briefs

**Files:**
- Modify: `server/openai.js`
- Test: `tests/openai-candidates.test.js`

- [ ] Add a fake-client test asserting a strict `crop_candidate_briefs` schema with exactly four existing crop IDs, concise `summary`, `pros`, and `cons` fields.
- [ ] Verify the test fails because `briefCropCandidates` does not exist.
- [ ] Add `briefCropCandidates(context, openai)` that supplies only normalized ranking, weather, profile, evidence IDs, and financial contract; reject unknown/duplicate IDs and merge prose back onto deterministic candidate records.
- [ ] Re-run the focused test and verify model prose cannot replace any cost, score, crop ID, or safety field.

### Task 3: Two-stage workflow and persistence

**Files:**
- Modify: `server/workflow.js`
- Modify: `server/memory.js`
- Test: `tests/workflow.test.js`
- Test: `tests/memory-sessions.test.js`

- [ ] Add failing tests: `action: "analyze"` returns `candidateSelectionRequired: true` with no `seasonPlan` or `inputSchedule`; `action: "plan"` requires a valid `selectedCropId` and returns only that crop's full plan.
- [ ] Add a persistence test proving candidate set and selected crop survive memory reload while the original farm size and budget remain unchanged.
- [ ] Implement the analyze branch through weather, retrieval, ranking, and `briefCropCandidates`, then persist candidate state on the active session.
- [ ] Implement selected-crop validation against the persisted candidate IDs, build the full plan for that crop, and save `selectedCropId`, `plannedAreaAcres`, and the result to the active memory session.
- [ ] Re-run workflow and memory tests.

### Task 4: Chat-native candidate selector

**Files:**
- Create: `src/components/CropCandidateSelector.jsx`
- Modify: `src/App.jsx`
- Modify: `src/i18n.js`
- Modify: `src/styles.css`
- Test: `tests/ui-contract.test.js`

- [ ] Add a failing source/UI contract test for four accessible radio-like crop cards containing pros, cons, budget, full-farm cost, gap/remaining, affordable area, and `Choose crop`.
- [ ] Implement `CropCandidateSelector` inside the assistant message. Disable repeated choice during the streamed selected-plan request and mark the persisted selected crop.
- [ ] Change initial plan submission to `action: "analyze"`; send `action: "plan"` with `selectedCropId` only from a candidate button.
- [ ] Hide full recommendation sections until the selected-plan result exists, with natural English and Bangla labels.
- [ ] Re-run UI and build tests.

### Task 5: Desktop reflow and budget clarity

**Files:**
- Modify: `src/styles.css`
- Modify: `src/App.jsx`
- Test: `tests/ui-contract.test.js`

- [ ] Add failing contracts for a bounded top workspace grid and a full-width post-selection result region.
- [ ] Move recommendation/schedule/ranking/roadmap/evidence markup outside the chat/right-rail grid and style it with `grid-column: 1 / -1`; keep mobile single-column.
- [ ] Add a prominent budget strip that renders saved budget, selected plan cost, and remaining/shortfall together.
- [ ] Run UI contracts and production build.

### Task 6: End-to-end verification and delivery

**Files:**
- Modify: `README.md`
- Modify: `docs/official-judge-audit.md`

- [ ] Run `npm run check` and expect all tests plus Vite build to pass.
- [ ] Run `npm audit --omit=dev` and expect zero vulnerabilities.
- [ ] Deploy to the VPS using the existing deployment script, which repeats tests/build before PM2 switch-over.
- [ ] In the signed-in in-app browser, verify the exact 10-acre/Pabna/clay/rainfed/BDT 50,000/Rabi case, select one candidate, and confirm budget and memory survive logout/login.
- [ ] Commit the verified files and push `codex/agrisense-tier2-multimodal`.
