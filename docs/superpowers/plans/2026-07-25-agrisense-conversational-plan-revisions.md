# AgriSense Conversational Plan Revisions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn post-plan profile edits into a polished clarification flow with an explicit, persistent Create updated plan action.

**Architecture:** Add a deterministic server-side conversation interpreter and split lightweight chat turns from streamed planning turns. Keep the current plan visible but stale while revisions are staged, auto-create private memory at the explicit plan boundary, and fix transcript pinning at the source.

**Tech Stack:** React 19, Express, Node test runner, NDJSON activity streaming, existing session/memory services, semantic CSS.

---

### Task 1: Deterministic revision interpretation

**Files:**
- Create: `server/conversation.js`
- Create: `tests/conversation.test.js`

- [ ] **Step 1: Write failing interpreter tests**

Cover:

```js
interpretConversationTurn("I want to change my budget.", profile, {})
// => { kind: "clarify_value", pendingField: "budgetBdt" }

interpretConversationTurn("BDT 40,000", profile, { pendingField: "budgetBdt" })
// => { kind: "revision_staged", patch: { budgetBdt: 40000 } }

interpretConversationTurn("Change my budget to BDT 40,000.", profile, {})
// => revision_staged without a redundant question
```

Also cover generic edit intent, invalid budgets, farm size, soil, water, season, unchanged values, and unrelated questions.

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `node --test tests/conversation.test.js`

Expected: failure because `server/conversation.js` does not exist.

- [ ] **Step 3: Implement the minimal interpreter**

Export:

```js
export function interpretConversationTurn(message, currentProfile = {}, context = {}) {
  return {
    kind,
    assistant,
    pendingField,
    patch,
    changedFields,
  };
}
```

Use allow-listed field aliases and deterministic value parsers. Return raw patches only; workflow validation remains authoritative.

- [ ] **Step 4: Run focused tests and confirm GREEN**

Run: `node --test tests/conversation.test.js`

Expected: all interpreter tests pass.

- [ ] **Step 5: Commit**

```powershell
git add server/conversation.js tests/conversation.test.js
git commit -m "feat: interpret conversational farm revisions"
```

### Task 2: Split chat intake from explicit planning

**Files:**
- Modify: `server/workflow.js`
- Modify: `server/index.js`
- Modify: `tests/workflow.test.js`

- [ ] **Step 1: Write failing workflow tests**

Assert that `action: "chat"`:

- returns `kind: "clarify_value"` for a vague budget change;
- persists a validated BDT 40,000 profile revision;
- returns `readyToPlan: true` and `planStale: true`;
- never calls weather, retrieval, ranking, scheduling, or explanation;
- saves the revised profile into connected memory without replacing the existing plan.

Assert that `action: "plan"` runs the existing full workflow using the staged profile.

- [ ] **Step 2: Run the focused tests and confirm RED**

Run: `node --test tests/workflow.test.js`

Expected: chat turns currently enter the full planning path.

- [ ] **Step 3: Implement the chat branch**

Inject `interpretConversationTurn` through `workflowFor`. Load the session and optional memory before routing. For chat turns, validate and persist revisions, update connected memory with the existing plan, and return a bounded conversational response. Preserve the current stream contract for explicit plan turns.

- [ ] **Step 4: Run workflow and memory tests**

Run: `node --test tests/workflow.test.js tests/memory.test.js`

Expected: all pass.

- [ ] **Step 5: Commit**

```powershell
git add server/workflow.js server/index.js tests/workflow.test.js
git commit -m "feat: gate planning behind farmer confirmation"
```

### Task 3: Client revision state and automatic memory

**Files:**
- Create: `src/conversation.js`
- Create: `src/components/PlanRevisionCard.jsx`
- Create: `tests/client-conversation.test.js`
- Modify: `src/App.jsx`
- Modify: `tests/ui-contract.test.js`

- [ ] **Step 1: Write failing client tests**

Cover pure helpers that:

- append a lightweight assistant turn without creating an agent run;
- retain `pendingField` between replies;
- expose Create updated plan only on the latest ready revision;
- mark the previous plan stale;
- clear the draft only after a successful plan.

Add UI contracts for the accessible button label, stale-plan notice, and `/api/session/message` chat route.

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `node --test tests/client-conversation.test.js tests/ui-contract.test.js`

Expected: missing client conversation module and CTA.

- [ ] **Step 3: Implement lightweight chat submission**

Composer submit calls `/api/session/message` with:

```js
{
  action: "chat",
  message,
  pendingField,
  sessionId,
  memoryId
}
```

Render the response as an ordinary assistant message. Do not create `AgentRunMessage` for chat intake.

- [ ] **Step 4: Implement explicit plan creation**

`createUpdatedPlan()` first calls the existing memory-create API when no memory is connected, stores the returned recovery state, then calls the streamed `send` path with `action: "plan"`. On success, clear stale state and mark the revision card complete.

- [ ] **Step 5: Run focused and full client tests**

Run: `node --test tests/client-conversation.test.js tests/ui-contract.test.js tests/session.test.js tests/stream.test.js`

Expected: all pass.

- [ ] **Step 6: Commit**

```powershell
git add src/conversation.js src/components/PlanRevisionCard.jsx src/App.jsx tests/client-conversation.test.js tests/ui-contract.test.js
git commit -m "feat: add conversational plan revision flow"
```

### Task 4: Transcript polish and scroll repair

**Files:**
- Create: `src/chat-scroll.js`
- Create: `tests/chat-scroll.test.js`
- Modify: `src/App.jsx`
- Modify: `src/styles.css`
- Modify: `tests/ui-contract.test.js`

- [ ] **Step 1: Write failing scroll and visual tests**

Test the near-bottom policy and assert the UI contains avatar-led message rows, a sticky composer, a revision card, a stale banner, reduced-motion behavior, and no programmatic smooth-scroll feedback loop.

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `node --test tests/chat-scroll.test.js tests/ui-contract.test.js`

Expected: current transcript uses self-cancelling smooth scrolling and lacks the new visual contracts.

- [ ] **Step 3: Implement deterministic pinning**

Use an instant scroll while messages stream or append, update pinning only from explicit wheel/touch/pointer user intent, and keep manual reading position when the farmer scrolls upward.

- [ ] **Step 4: Apply the approved chat visual system**

Use compact avatar-led rows, a quiet assistant surface, a raised composer, one turmeric revision action, and a restrained stale-plan banner. Preserve the existing brand tokens, focus states, reduced motion, and responsive breakpoints.

- [ ] **Step 5: Run focused tests and build**

Run: `node --test tests/chat-scroll.test.js tests/ui-contract.test.js`

Run: `npm run build`

Expected: focused tests and production build pass.

- [ ] **Step 6: Commit**

```powershell
git add src/chat-scroll.js src/App.jsx src/styles.css tests/chat-scroll.test.js tests/ui-contract.test.js
git commit -m "fix: polish and pin the farmer transcript"
```

### Task 5: Multi-session workspace under one recovery code

**Files:**
- Modify: `server/memory.js`
- Modify: `server/index.js`
- Modify: `server/workflow.js`
- Create: `src/components/ConversationSidebar.jsx`
- Create: `tests/memory-sessions.test.js`
- Create: `server/memory-summary.js`
- Create: `tests/memory-summary.test.js`
- Modify: `src/App.jsx`
- Modify: `src/styles.css`
- Modify: `tests/ui-contract.test.js`

- [x] **Step 1: Write failing memory-session tests**

Prove that one recovery code can create two sessions, keep separate transcripts and plans, share one profile/preferences object, cap retained sessions/messages, and load legacy version-1 memory as an empty session list. Prove that useful facts produce a bounded canonical memory summary while secrets, recovery codes, irrelevant chat, and raw traces are excluded.

- [x] **Step 2: Run focused tests and confirm RED**

Run: `node --test tests/memory-sessions.test.js tests/memory-summary.test.js tests/memory.test.js`

Expected: the current memory service exposes only one top-level plan and summary.

- [x] **Step 3: Implement version-2 memory sessions**

Add `sessions` to normalized/public memory and serialized writes. Add atomic `createConversationSession` and `appendConversationTurn` operations. Update `savePlan` to attach the plan to `memorySessionId` while preserving every other session and preference. Build and persist a compact allow-listed summary from the shared profile and explicit planning preferences.

- [x] **Step 4: Add session API and workflow integration**

Create one bounded session endpoint for new chats. Pass `memorySessionId` through chat and plan requests so transcripts and plans are persisted without exposing the recovery code to activity or model context. Pass only the compact memory summary to recommendation generation and acknowledge relevant remembered context in the response.

- [x] **Step 5: Build the recent-chat workspace**

Add an accessible recent-chat rail, New chat action, active session state, auto-generated titles, and session switching. New chats inherit shared memory but start with an empty transcript and plan.

- [x] **Step 6: Run focused and build gates**

Run: `node --test tests/memory-sessions.test.js tests/memory.test.js tests/workflow.test.js tests/ui-contract.test.js`

Run: `npm run build`

Expected: all pass.

- [x] **Step 7: Commit**

```powershell
git add server/memory.js server/index.js server/workflow.js src/components/ConversationSidebar.jsx src/App.jsx src/styles.css tests/memory-sessions.test.js tests/memory.test.js tests/workflow.test.js tests/ui-contract.test.js
git commit -m "feat: add recovery-linked conversation sessions"
```

### Task 6: Farmer-side browser and persistence verification

**Files:**
- Modify: `docs/superpowers/agrisense-tier1-ui-defect-ledger.md`

- [x] **Step 1: Run all automated gates**

Run: `npm run check`

Run: `npm audit --omit=dev`

Expected: all tests pass, production build succeeds, and audit reports zero vulnerabilities.

- [x] **Step 2: Run the exact in-app browser acceptance flow**

Click and type:

1. Start fresh Gazipur demo.
2. Wait for the first plan.
3. Send “I want to change my budget.”
4. Confirm the assistant asks only for the new budget and no activity run appears.
5. Send “BDT 40,000.”
6. Confirm a revision summary and Create updated plan button appear.
7. Confirm the previous plan is labeled stale and still shows BDT 90,000.
8. Press Create updated plan.
9. Confirm private memory connects, the activity streams inside chat, and the new plan uses BDT 40,000.
10. Reload and resume with the recovery flow; confirm the revised profile and plan restore.

Also test light/dark modes, mobile width, keyboard focus, no horizontal overflow, and no console errors.

- [x] **Step 3: Update the defect ledger with exact evidence**

Record the pre-fix values, post-fix browser observations, test counts, timings, and remaining limitations.

- [x] **Step 4: Commit and push after verification**

```powershell
git add docs/superpowers/agrisense-tier1-ui-defect-ledger.md
git commit -m "docs: record conversational revision verification"
git push origin codex/agrisense-conversation-revisions
```
