# AgriSense Two-Stage Crop Selection Design

## Goal

Replace the current immediate full-plan response with a model-orchestrated choice flow: analyze the completed farm profile, present four grounded crop candidates, let the farmer choose one, then generate and persist only that crop's complete plan.

## Farmer flow

1. AgriSense collects and normalizes the farm profile.
2. The analysis run retrieves weather and agronomy evidence, calculates truthful financial baselines, and asks the model to produce four concise candidate briefs.
3. Each candidate shows fit, pros, cons, full-farm estimated cost, budget gap, and maximum affordable planted area.
4. The farmer selects one candidate in the assistant message.
5. A second streamed run generates the dated plan, schedule, grounded explanation, and evidence trace for that selected crop and affordable planted area.
6. Candidate set, selection, compact conversation, farm profile, and final plan remain in the account-bound PostgreSQL memory.

## Financial integrity

`farmSizeAcres` and `budgetBdt` remain farmer facts and are never overwritten by the planning calculation. `plannedAreaAcres` is a separate derived value: `min(farmSizeAcres, budgetBdt / costPerAcreBdt)`. UI always places budget, estimated plan cost, and remaining budget or shortfall together. A crop that exceeds the full-farm budget is labelled honestly; it is never presented as a budget fit.

## Model and evidence boundary

The model chooses and explains the four candidates using tool-returned ranking, weather, RAG, and deterministic financial records. It returns a strict structured schema keyed by existing crop IDs. The model does not invent crop IDs or recalculate costs. Deterministic code retains arithmetic, validation, safety prohibitions, and provenance; the model owns selection, farmer-facing pros/cons, and explanation.

## UI layout

Candidate cards render inside the assistant conversation message with a single clear selection button each. Before selection, detailed recommendation, schedule, roadmap, and evidence panels stay hidden. After selection, the result area starts below the complete chat/right-rail row and spans the available desktop width, preventing the previous tall-right-rail blank column. Mobile remains single-column.

## Failure behavior

If model candidate narration fails, the four grounded ranked candidates remain available with safe evidence-derived fallback briefs. If plan generation fails, the selected candidate and previous saved plan remain visible and retryable. PostgreSQL writes are serialized so candidate selection and final-plan persistence cannot overwrite each other.

## Acceptance

- A 10-acre, BDT 50,000 profile keeps both values unchanged.
- Four candidates appear before any full plan.
- Every candidate exposes pros, cons, cost, gap, and affordable area.
- Selecting exactly one candidate triggers one full-plan run for that crop.
- Logout/login restores the candidate choice, chat, profile, and final plan.
- Desktop has no large empty lower-left region; mobile has no horizontal overflow.
