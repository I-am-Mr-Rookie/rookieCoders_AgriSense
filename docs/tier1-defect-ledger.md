# AgriSense Tier 1 Defect Ledger

Authority order: Koushik's latest instruction, official final-round contract and rubric, executable evidence, approved Tier 1 plan, reports, best practices.

## Summary

| Metric | Count |
|---|---:|
| Candidate reports | 7 |
| Unique candidates after deduplication | 7 |
| Confirmed at baseline | 4 |
| Tier 1 feature gaps at baseline | 2 |
| Complete with required regression | 6 |
| Production-only latency gates | 1 |

## Findings

| ID | Official rule | Observable failure | Root cause | State | Evidence before | Effective fix | Evidence after | Regression | Commit | Residual risk |
|---|---|---|---|---|---|---|---|---|---|---|
| T1-MEM | Persistent memory across sessions | Current browser storage resumes one opaque session but provides no explicit cross-device recovery or memory controls. | Session ID is browser-local and the API has no memory lifecycle contract. | COMPLETE | E1 `src/session.js`, `server/db.js` | Hashed bearer recovery ID, lifecycle service/API, clean-session resume, demo isolation, process-lifetime warning, serialized plan/preference writes, and immediate controls. | E3 lifecycle, edge-ID redaction, race, cancellation rollback, validation, and DB/session regressions. | 103/103 suite plus live create/capture/resume/stale-session/preferences/reset and browser isolation. | Pending | Recovery key remains a bearer credential; authenticated accounts are Tier 2. |
| T1-SCH | Fertilizer and irrigation scheduler | Tier 0 exposes generic checkpoints without a grounded adjustable input schedule. | No deterministic scheduling model exists beyond `buildSeasonPlan`. | COMPLETE | E1 `server/core.js` | Deterministic fertilizer/irrigation schedule, date control, evidence/truth disclosures, preferences, confirmation boundary, and rain delay. | E3 scheduler and full-flow tests plus browser plan. | Two operations; live rain-day adjustment reachable; no invented dose or chemical action. | Pending | Exact quantity is omitted when evidence does not support it. |
| UX-STREAM | Visible agent trace and active feedback | Browser shows a generic busy bar and receives tool trace only after the full request finishes. | One blocking JSON response with no progress transport. | COMPLETE | E1 `src/App.jsx`, `server/index.js` | NDJSON stream with ordered sanitized events and independent disclosures. | E3 chunk/failure tests; E4 local HTTP and browser flow. | 11 streamed events; zero browser console errors. | Pending | Production proxy buffering still needs VPS measurement. |
| UX-MD | Usable conversational output | Markdown syntax is rendered as plain text. | Assistant text is inserted directly into a paragraph. | COMPLETE | E1 `src/App.jsx`; user observation | `react-markdown` plus GFM, raw HTML skipped, safe external links. | E3 UI source contract and production build. | Full suite and browser render passed. | Pending | Model output remains untrusted; custom HTML is deliberately unavailable. |
| UX-CARD | Independent disclosures | Opening one crop disclosure visually stretches all four cards. | CSS Grid's default cross-axis stretch equalizes cards in the row. | COMPLETE | E1 supplied screenshot plus `src/styles.css` | Start-align grid items and self-align each card. | E4 measured browser geometry. | `[248,248,248,248]` to `[340,248,248,248]`; one open. | Pending | None observed at desktop or 390 px. |
| AI-EFFORT | Speed policy | Model calls default to high reasoning for routine and hard requests alike. | Static high default and no classifier. | COMPLETE | E1 `server/openai.js` | Medium default; deterministic high escalation for simulations, comparisons, optimization, trade-offs, and long prompts. | E3 routine and hard-case unit tests. | Full suite passed. | Pending | Heuristic complexity classification may need tuning from real usage. |
| PERF-01 | Under-10-second target | Production reportedly takes 20-30 seconds while local is faster. | Sequential cold provider calls dominate; target-VPS model/proxy/resource contribution is not yet measured. | UNRESOLVED | E0 production report plus E1 critical-path inspection. | Per-phase timings, immediate streamed events, five-minute weather cache. | E4 local cold/warm measurements. | Successful uncached 2.2 s; cached 87 ms; one cold weather timeout at 7.1 s. | Pending | Production sub-10-second claim remains gated on VPS p50/p95 measurement. |

Allowed states: `CONFIRMED`, `DUPLICATE`, `FALSE_POSITIVE`, `OUT_OF_CONTRACT`, `HARDENING_ONLY`, `UNRESOLVED`, `COMPLETE`.

Deduplication key: official rule + observable failure + root cause + effective fix.

## Contract-To-Plan Delta

| Topic | Official source | Approved plan | Decision | Evidence or approval |
|---|---|---|---|---|
| Tier 1 scope | Memory, proactive advice, scheduler, pest risk, simulation are optional differentiators. | Memory plus scheduler mandatory; broad alerts optional. | Compatible. | Koushik selected A+C, then B only if time. |
| Agent reasoning | Explain recommendations and expose tool trace. | Show truthful application events and optional API-provided summaries, never private chain-of-thought. | Follow platform truth boundary. | Official OpenAI docs do not expose raw reasoning tokens. |
| Persistent identity | Remember across sessions, ideally across devices. | Explicit bearer recovery key; no new authentication system. | Compatible with explicit security limitation. | Koushik requested cross-session personalization; two-hour plan excludes auth. |
| Scheduler safety | Practical fertilizer, irrigation, preventive/treatment advice. | Deterministic schedule; confirmation for fertilizer/pest/chemical; no chemical advice without registry evidence. | Stronger safe subset. | Koushik explicitly retained the chemical prohibition. |
| Performance | No official sub-10-second requirement. | Target p50 under 10 seconds plus immediate progress. | Internal target only; never score as official. | Koushik requested it. |
| Delivery | Repository commit before organizer cutoff. | Local verification, commit, push; no deployment. | Compatible with latest instruction. | Koushik explicitly excluded deployment for this phase. |
| VPS | Not required by official contract. | Diagnose only; do not resize. | Deferred. | Approved plan and latest scope. |

## Baseline Evidence

- Handoff validator: pass, 7 steps, 120-minute budget.
- `npm.cmd run check`: 68 tests passed, 0 failed; Vite production build passed.
- Baseline revision: `07f192e6a816d24e949b459a4bbb18ce69aa9cbd`.
- Baseline remote: `origin/main` matches local `HEAD`.
- Pre-existing untracked file preserved: `roadmap-t0.html`.

## Final Recovery State

- Target path: `C:\Users\HP\Documents\IUT Hackathon\Final\Claude`
- Branch and remote: `main`; `origin`
- Deadline mode: Normal
- Implementation clock start: 25 July 2026 00:59 Asia/Dhaka
- Completed step IDs: preflight, memory, scheduler, activity/Markdown/theme/cards, performance, local API/browser validation
- Last successful full gate: `npm.cmd run check` — 103/103 plus production build and zero-vulnerability audit
- Running services: local server only during validation; stop before handoff
- Active blocker: none
- Next exact action: final diff/secret scan, commit, and push
- Pre-existing untracked file preserved: `roadmap-t0.html`
