# AgriSense Tier 0 Readiness Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repair the completed-plan browser crash, expose the official financial fields, refresh evidence, and deploy the exact verified Tier 0 revision before 22:20 Asia/Dhaka.

**Architecture:** Add one shared response-normalization boundary used by Express and React, without changing the planning pipeline. Render financial values already computed by `server/core.js`; do not add a new data source, embedding system, or Tier 1 behavior.

**Tech Stack:** Node.js 22, Express 5, React 19, Vite 7, Node test runner, PostgreSQL, PM2, Nginx, DigitalOcean.

---

### Task 1: Make the completed response browser-safe

**Files:**
- Create: `shared/assistant.js`
- Create: `tests/assistant.test.js`
- Modify: `server/index.js`
- Modify: `src/App.jsx`

- [ ] **Step 1: Write the failing shared-contract test**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { assistantText } from "../shared/assistant.js";

test("normalizes string and structured assistant responses for React", () => {
  assert.equal(assistantText("hello"), "hello");
  assert.equal(assistantText({ text: "grounded plan" }), "grounded plan");
  assert.equal(assistantText({}), "AgriSense returned an unreadable response.");
});
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `node --test tests/assistant.test.js`  
Expected: failure because `shared/assistant.js` does not exist.

- [ ] **Step 3: Add the minimal shared normalizer**

```js
export function assistantText(value) {
  if (typeof value === "string" && value.trim()) return value;
  if (typeof value?.text === "string" && value.text.trim()) return value.text;
  return "AgriSense returned an unreadable response.";
}
```

- [ ] **Step 4: Use the boundary on both sides**

In `server/index.js`, import `assistantText` and return `assistant: assistantText(explanation)`.  
In `src/App.jsx`, import `assistantText` and append `assistantText(data.assistant)`.

- [ ] **Step 5: Verify GREEN**

Run: `node --test tests/assistant.test.js`  
Expected: 1/1 pass.

### Task 2: Expose the official financial projection fields

**Files:**
- Create: `tests/ui-contract.test.js`
- Modify: `src/App.jsx`

- [ ] **Step 1: Write the failing UI contract test**

Read `src/App.jsx` and assert that the visible labels include `Itemized cost`, `Total cost`, `Expected yield`, `Expected revenue`, `Net profit`, `ROI`, and `Break-even yield`.

- [ ] **Step 2: Run and confirm RED**

Run: `node --test tests/ui-contract.test.js`  
Expected: failure because itemized cost, total cost, and expected yield are absent.

- [ ] **Step 3: Render existing deterministic fields**

Add total cost, expected yield, and price per kg to the recommendation summary. Render `best.financials.costBreakdownBdt` as an itemized list labeled `Itemized cost`. Do not change finance arithmetic.

- [ ] **Step 4: Verify GREEN**

Run: `node --test tests/ui-contract.test.js`  
Expected: 1/1 pass.

### Task 3: Run regression and refresh evidence

**Files:**
- Modify: `README.md`
- Modify: `currentprogress.md`
- Modify: `evaluation.html`
- Modify: `next-session-prompt.md`

- [ ] **Step 1: Run the complete local gate**

Run: `npm.cmd run check`  
Expected: all tests pass and Vite build exits 0.

- [ ] **Step 2: Run static release gates**

Run `git diff --check`, scan tracked source and `dist` for secret-shaped values, and confirm no credential files are tracked.

- [ ] **Step 3: Refresh truthful evidence**

Record the actual test count, current commit context, fixed browser contract, production verification status, exact limitations, and deferred embeddings/aliases. Remove only stale pre-deployment claims.

- [ ] **Step 4: Commit**

Stage only intended tracked files and commit with `fix: make Tier 0 judge path browser-safe`.

### Task 4: Deploy and prove the exact revision

**Files:** no additional source files unless a verified deployment-only correction is required.

- [ ] **Step 1: Push the verified commit to `origin/main`**

Verify remote SHA equals local SHA.

- [ ] **Step 2: Fast-forward the existing Droplet checkout**

Preserve the server-only backup branch, run `npm ci`, `npm test`, `npm run build`, restart `agrisense` with PM2, and save PM2 state.

- [ ] **Step 3: Run production gates**

Verify `/api/health`; run the Gazipur flow; run a two-turn vague free-text flow; confirm the final `assistant` value is a string, four crops and six stages return, and all five model-selected tools are present.

- [ ] **Step 4: Run the browser judge path**

In Chrome, click **Run Gazipur demo** and verify the recommendation, financial details, plan, evidence, and trace render without React console errors. Repeat the visible natural-language two-turn path if time remains.

- [ ] **Step 5: Final readback**

Verify local, GitHub, and Droplet SHAs match; report exact evidence, residual gaps, and Tier 1 deferral at 22:20.

