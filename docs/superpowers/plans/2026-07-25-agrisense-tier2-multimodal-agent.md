# AgriSense Tier 2 Multimodal Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add current web-grounded market intelligence, plant-disease image input, and a Bangla-first Realtime voice companion to the existing AgriSense chat with honest fallbacks.

**Architecture:** Use focused server adapters around the OpenAI Responses and Realtime APIs, keeping raw SDK output out of React. Extend the existing inline agent-message system and composer, preserve recovery-linked sessions, and keep all credentials server-side.

**Tech Stack:** React 19, Express 5, OpenAI Node SDK, Responses API, Realtime WebRTC, Node test runner, Vite.

---

## File map

- Create `server/tier2-validation.js`: normalize and validate market, image, and realtime requests.
- Create `server/market-intelligence.js`: invoke hosted web search and normalize citations/results.
- Create `server/disease-diagnosis.js`: invoke vision and enforce the diagnosis/safety schema.
- Create `server/realtime.js`: build Realtime session instructions and mint ephemeral client secrets.
- Create `src/tier2.js`: pure attachment, transcript, and Tier 2 conversation helpers.
- Create `src/realtime.js`: WebRTC lifecycle and event-channel adapter.
- Create `src/components/Tier2ComposerTools.jsx`: accessible market, image, and voice controls.
- Create `src/components/Tier2Result.jsx`: render citations and bounded diagnosis/market records.
- Modify `server/index.js`: expose validated Tier 2 routes and advertise capabilities.
- Modify `server/openai.js`: use the documented configurable model default.
- Modify `src/App.jsx`: connect Tier 2 controls/results to the existing chat.
- Modify `src/styles.css`: add responsive, theme-tokenized Tier 2 states.
- Modify `.env.example` and `README.md`: document model and Realtime configuration.
- Create `tests/tier2-validation.test.js`, `tests/market-intelligence.test.js`, `tests/disease-diagnosis.test.js`, `tests/realtime.test.js`, and `tests/tier2-ui-contract.test.js`.

### Task 1: Request and safety contracts

**Files:**
- Create: `tests/tier2-validation.test.js`
- Create: `server/tier2-validation.js`

- [ ] **Step 1: Write failing tests**

Cover accepted supplier and price queries, missing location/query rejection, safe HTTPS citation normalization, image media-type rejection, invalid Base64 rejection, and the 5 MiB decoded-size limit.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/tier2-validation.test.js`

Expected: failure because `server/tier2-validation.js` does not exist.

- [ ] **Step 3: Implement minimal validation**

Export:

```js
export function validateMarketRequest(input) {}
export function validateDiseaseImage(input) {}
export function normalizeSource(source) {}
```

Errors use the existing `ValidationError`; only `https:` and `http:` source URLs survive normalization.

- [ ] **Step 4: Verify GREEN**

Run: `node --test tests/tier2-validation.test.js`

Expected: all Task 1 tests pass.

### Task 2: Web-grounded market intelligence

**Files:**
- Create: `tests/market-intelligence.test.js`
- Create: `server/market-intelligence.js`
- Modify: `server/index.js`

- [ ] **Step 1: Write failing adapter and HTTP-contract tests**

Assert that the adapter sends:

```js
{
  model: "gpt-5.6",
  tools: [{ type: "web_search", search_context_size: "low" }],
  include: ["web_search_call.action.sources"]
}
```

Assert that duplicate URL citations collapse, unsafe URLs are excluded, current retrieval time is returned, and absent API configuration produces a recoverable `503` without fake data.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/market-intelligence.test.js`

Expected: failure because the market adapter/routes do not exist.

- [ ] **Step 3: Implement adapter and route**

Export:

```js
export function createMarketIntelligenceService({ client, model, now }) {}
```

Add `POST /api/tier2/market`. The system prompt requires Bangladesh scope, comparable units, visible source citations, explicit unknowns, and no fabricated supplier claims.

- [ ] **Step 4: Verify GREEN**

Run: `node --test tests/market-intelligence.test.js tests/http-contract.test.js`

Expected: all market and existing HTTP contracts pass.

### Task 3: Vision diagnosis

**Files:**
- Create: `tests/disease-diagnosis.test.js`
- Create: `server/disease-diagnosis.js`
- Modify: `server/index.js`

- [ ] **Step 1: Write failing vision and safety tests**

Assert `input_image` is passed to Responses, strict JSON is normalized, uncertainty is retained, and `chemicalRecommendation` is forced to `null`.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/disease-diagnosis.test.js`

Expected: failure because the diagnosis adapter/routes do not exist.

- [ ] **Step 3: Implement adapter and route**

Export:

```js
export function createDiseaseDiagnosisService({ client, model }) {}
```

Add `POST /api/tier2/disease`. The endpoint accepts one validated data URL, returns likely causes and safe next steps, and never persists the image.

- [ ] **Step 4: Verify GREEN**

Run: `node --test tests/disease-diagnosis.test.js tests/http-contract.test.js`

Expected: all diagnosis and existing HTTP contracts pass.

### Task 4: Realtime voice boundary

**Files:**
- Create: `tests/realtime.test.js`
- Create: `server/realtime.js`
- Create: `src/realtime.js`
- Modify: `server/index.js`

- [ ] **Step 1: Write failing secret and lifecycle tests**

Assert the standard key is never returned, safety identifiers are stable hashes, instructions are Bangla-first and forbid hidden reasoning, and disconnect closes media tracks/data channels/peer connection.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/realtime.test.js`

Expected: failure because Realtime modules do not exist.

- [ ] **Step 3: Implement server and browser adapters**

Use `POST /v1/realtime/client_secrets` on the server with `gpt-realtime-2.1`, low reasoning, a concise preamble policy, and a server-generated privacy-preserving safety identifier. Use an `RTCPeerConnection` and `oai-events` data channel in the browser.

- [ ] **Step 4: Verify GREEN**

Run: `node --test tests/realtime.test.js tests/http-contract.test.js`

Expected: all Realtime and existing HTTP contracts pass.

### Task 5: Chat-native Tier 2 controls

**Files:**
- Create: `tests/tier2-ui-contract.test.js`
- Create: `src/tier2.js`
- Create: `src/components/Tier2ComposerTools.jsx`
- Create: `src/components/Tier2Result.jsx`
- Modify: `src/App.jsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Write failing pure-state and source-rendering tests**

Cover attachment validation, image-preview state, visible transcript correction, market/disease message records, deduplicated citations, and retry preservation.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/tier2-ui-contract.test.js`

Expected: failure because Tier 2 client modules do not exist.

- [ ] **Step 3: Implement controls and message rendering**

Add `Market`, `Attach leaf`, and microphone controls inside the existing composer. Market and diagnosis requests create farmer messages and inline AgriSense run/results. Voice displays connection state and editable transcript. All controls use semantic buttons, visible focus, reduced-motion support, and existing theme tokens.

- [ ] **Step 4: Verify GREEN**

Run: `node --test tests/tier2-ui-contract.test.js tests/ui-contract.test.js`

Expected: all Tier 2 and existing UI contracts pass.

### Task 6: Configuration, sample, and focused verification

**Files:**
- Modify: `.env.example`
- Modify: `README.md`
- Add: `public/samples/plantvillage-tomato-late-blight.jpg`
- Add: `public/samples/plantvillage-attribution.md`

- [ ] **Step 1: Update configuration documentation**

Document:

```dotenv
OPENAI_MODEL=gpt-5.6
OPENAI_REALTIME_MODEL=gpt-realtime-2.1
OPENAI_REALTIME_VOICE=marin
```

Document that Bengali speech quality requires real-field evaluation and that typed chat is the guaranteed fallback.

- [ ] **Step 2: Add the attributed PlantVillage sample**

Use one open-access disease image from the public PlantVillage repository and store the source URL, dataset citation, and label alongside it.

- [ ] **Step 3: Run focused automated verification**

Run:

```powershell
npm test
npm run build
npm audit --omit=dev
```

Expected: zero test failures, successful Vite build, and zero production vulnerabilities.

- [ ] **Step 4: Run focused live and browser verification**

Start the server with the ignored local `.env`. Verify health, one market search, one sample-image diagnosis, Realtime client-secret creation, image upload/preview, market action, microphone permission/error state, dark/light responsive layout, keyboard focus, and no browser console errors.

- [ ] **Step 5: Commit and push**

Stage only Tier 2 files, preserving unrelated user changes. Commit as:

```text
feat: add multimodal Tier 2 farm intelligence
```

Push `main` to `origin`.
