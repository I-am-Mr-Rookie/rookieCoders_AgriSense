# AgriSense Tier 0 Defect Ledger

Frozen on 24 July 2026 for the 95/100 release-readiness campaign. Evidence levels are: E1 static inspection, E2 focused executable probe, E3 regression/integration, and E4 clean-target end to end.

| ID | Root cause and baseline | Fix commits | Regression evidence | State / residual risk |
|---|---|---|---|---|
| T0-VAL-01 | Intake accepted unsupported values and non-Bangladesh locations; dependency failures could expose raw messages. Baseline `cbb0450` (E1/E2). | `669571d`, `584810f`, `0db6300`, `773550b` | Canonical district/adversarial validation, public 400 probe, two-turn free-text intake, and merged 68/68 suite. | `VERIFIED_TARGET`; initial-save failure remains injected rather than destructively forced on production. |
| T0-PERSIST-01 | A failed initial database save was incorrectly described as safely persisted. Baseline `584810f` (E1/E2). | `0db6300` | Injected failure probes plus a public partial-save, PM2 restart, same-session completion. | `VERIFIED_TARGET`; destructive database outage was intentionally not induced. |
| T0-RAG-01 | Meaningful zero-overlap queries returned arbitrary zero-score fact cards. Baseline `0db6300` (E2). | `7d58506`, `f33aa88` | Irrelevant, stop-word-only, Bengali, and injection-like queries return no rows; empty/punctuation structured browsing remains available. | `VERIFIED_TARGET` through the merged local 68/68 suite; Droplet rerun follows deployment. |
| T0-GROUND-01 | Crop results lacked a complete deterministic rationale and model-loop failure aborted the plan. Baseline `0db6300` (E1/E2). | `7d58506` | All crops expose profile/weather/RAG/penalty/assumption inputs; injected failure recovers; public trace selected all five tools. | `VERIFIED_TARGET`; provider failure remains safely injected. |
| T0-UX-01 | Demo sessions could reuse state; initial status overstated weather readiness; accessibility/mobile contracts were incomplete. Baseline `7d58506` (E1/E2). | `9e416b3` | Nine UI contracts, Chrome DOM, visible Computer Use, and 320/360/375 no-overflow probes. | `VERIFIED_TARGET`; mounted UI regression tests remain a maintainability improvement. |
| T0-REL-01 | Health did not identify the deployed source revision. Baseline `0db6300` (E1). | `9eac23c` | Revision tests plus GitHub/Droplet/PM2/public-health SHA equality. | `VERIFIED_TARGET`. |
| T0-MERGE-01 | Kawsar's archive had stronger visual hierarchy but incompatible APIs, misleading localhost RAG status, packaged private artifacts, and unsafe Tier-2 routes. | Current merge commit | Only the score disclosure, truth pills, prompt chips, design tokens, progress treatment, and responsive polish were adapted; the backend, bdapps, stub RAG, secrets, persisted data, and generated build were rejected. | `VERIFIED_LOCAL`; public visual regression remains required after deployment. |
| T0-HARDEN-01 | Browser reload generated a new session ID; malformed JSON exposed Express's HTML error page; retrieved plan evidence did not affect action text; sequential model turns increased latency. | Current merge commit | Reload-storage, parser-error, evidence-differential, call-limit, and parallel-tool tests pass in the merged 68/68 suite; local malformed JSON returns a sanitized 400. | `VERIFIED_LOCAL`; production timing and public parser probes remain required after deployment. |

## Review decisions

- Kawsar's screenshot was treated as a lead, not proof. Its useful claims were independently verified against the repository before patching.
- No extra BARC scraping was performed. The existing nine-dataset corpus and focused retrieval tests were sufficient for these confirmed root causes.
- Tier 1/2, bdapps integration, architectural replacement, and new external data ingestion remain out of the Tier 0 release scope.

## Final release gates

All release-blocking Tier 0 gates passed at the frozen 95/100 threshold. The five deducted points remain explicit: mounted React interaction coverage, dedicated weather-timeout and duplicate-request concurrency tests, a destructive dependency-outage exercise in a disposable target, and maintainability headroom. Seasonal Rabi weather/financial revalidation, Tier 1/2, and bdapps remain outside the release claim.
