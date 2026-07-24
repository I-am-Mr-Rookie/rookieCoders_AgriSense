# AgriSense Conversational Plan Revisions Design

## Problem evidence

The farmer-facing in-app browser reproduced four connected defects:

1. After the Gazipur demo completes, “I want to change my budget” launches the full planning workflow instead of asking for the missing value.
2. “Change my budget to BDT 40,000” produces a second plan that still uses BDT 90,000 when no OpenAI key is configured.
3. Every message becomes an 11-step agent run even when the message is only conversational intake.
4. Programmatic smooth scrolling fires the transcript scroll handler while it is still moving, disables auto-pinning, and strands the latest messages below a large blank visible area.

## Considered approaches

### A. Deterministic-first conversation state with explicit plan creation — selected

Parse common profile revisions locally on the server, ask focused follow-ups for missing fields or values, stage valid profile changes, and run planning only after the farmer presses an explicit button. Use the model only as a future fallback for genuinely ambiguous language.

This is fast, works without an API key, keeps costs predictable, and makes the Create Plan boundary auditable.

### B. Model-only conversational routing

Send every message to the model for intent classification and slot extraction. This handles more phrasing but fails in the current no-key local environment, adds latency to simple edits, and makes the demo less deterministic.

### C. Client-only revision wizard

Keep all revision state in React. This is fast to build but duplicates server validation, can lose state across reloads, and weakens memory consistency.

## Approved interaction

1. The Gazipur demo still creates the first plan directly.
2. After a plan exists, a message such as “I want to change my budget” produces a normal assistant message: “What should your new total season budget be?”
3. The next reply, such as “BDT 40,000,” is validated and saved as a draft profile revision. No weather, retrieval, ranking, or recommendation work runs yet.
4. AgriSense summarizes the change and displays **Create updated plan** inside the same assistant message. The existing plan remains visible but is labeled “Previous plan — profile changes are waiting.”
5. Pressing **Create updated plan**:
   - creates private memory automatically when none is connected;
   - displays the one-time recovery code using the existing safe UI;
   - runs the visible agent activity inside chat;
   - replaces the old recommendation only after successful completion;
   - saves the revised profile, generated plan, preferences, and a bounded conversation summary.
6. Generic edit requests use progressive clarification:
   - “I want to change my plan” → ask which farm detail;
   - “Budget” → ask for the new budget;
   - “BDT 40,000” → validate, stage, and offer plan creation.
7. Direct edits such as “Change my budget to BDT 40,000” skip unnecessary questions and immediately stage the valid change.

## Architecture and data flow

### Conversation interpreter

`server/conversation.js` owns deterministic intent and slot parsing. It recognizes editable profile fields, parses explicit values, compares them with the current profile, and returns one of:

- `clarify_field`
- `clarify_value`
- `revision_staged`
- `general`

The interpreter never generates recommendations and never bypasses `validateProfilePatch`.

### Chat request path

Normal composer submissions use `/api/session/message` with `action: "chat"` and an optional allow-listed `pendingField`. The planning workflow loads the session and memory, applies a validated patch when available, persists the revised profile, and returns a lightweight conversational result without planning events.

### Plan request path

The explicit button uses `/api/session/message/stream` with `action: "plan"`. It reuses the authoritative session profile and runs the existing weather, retrieval, ranking, scheduling, explanation, and memory-save pipeline.

### Client state

Conversation items may contain:

```js
{
  role: "agent",
  text: "Budget updated from BDT 90,000 to BDT 40,000.",
  revision: {
    pendingField: "",
    changedFields: ["budgetBdt"],
    readyToPlan: true,
    planStale: true
  }
}
```

Only the latest ready revision exposes the plan button. A successful plan marks it complete.

### Persistence

Draft profile changes are saved to the session immediately. When memory is connected, the revised profile and existing plan are saved together so preference/plan writes remain serialized. If memory is not connected, the Create Plan action first creates it from the current session snapshot and then passes the returned memory ID into planning.

## Visual direction

The transcript becomes the primary work surface:

- compact avatar-led message rows instead of large stacked panels;
- ordinary assistant replies use a quiet transparent surface;
- tool activity remains a distinct inset card;
- the composer is a raised, sticky footer within the chat panel;
- draft changes use a concise “Plan update ready” card with one turmeric action;
- stale recommendations receive a visible but restrained status banner;
- streaming updates pin instantly while active, with no animation-induced scroll race;
- keyboard focus, reduced motion, and mobile stacking remain complete.

## Error and safety behavior

- Invalid or out-of-range values produce a conversational correction and retain the pending field.
- A failed memory creation prevents planning and leaves the draft revision intact.
- A failed updated plan keeps the previous plan visible and labeled stale.
- Recovery codes never enter conversation text, activity details, model context, or logs.
- Chemical recommendations remain prohibited without current official registry evidence.
- No private chain-of-thought is rendered.

## Acceptance evidence

- Browser: demo → vague budget request → focused question → BDT 40,000 → revision summary → Create updated plan → new plan uses BDT 40,000.
- Browser: the transcript remains pinned to the latest message with no blank dead area.
- Browser: private memory is automatically connected and the recovery code appears once.
- Browser reload/resume: the saved profile and updated plan are restored through the existing recovery flow.
- Automated: deterministic parsing, pending-field continuation, no planning during chat turns, explicit plan gating, memory update, auto-scroll policy, and accessible CTA contracts.
- Regression: full `npm run check` and `npm audit --omit=dev`.

