# AgriSense Tier 0 Defect Ledger

Frozen on 24 July 2026 for the 95/100 release-readiness campaign. Evidence levels are: E1 static inspection, E2 focused executable probe, E3 regression/integration, and E4 clean-target end to end.

| ID | Root cause and baseline | Fix commits | Regression evidence | State / residual risk |
|---|---|---|---|---|
| T0-VAL-01 | Intake accepted unsupported values and non-Bangladesh locations; dependency failures could expose raw messages. Baseline `cbb0450` (E1/E2). | `669571d`, `584810f`, `0db6300`, `773550b` | Canonical district/adversarial validation, public 400 probe, and merged 58/58 suite. | `VERIFIED_TARGET`; initial-save failure remains injected rather than destructively forced on production. |
| T0-PERSIST-01 | A failed initial database save was incorrectly described as safely persisted. Baseline `584810f` (E1/E2). | `0db6300` | Injected failure probes plus a public partial-save, PM2 restart, same-session completion. | `VERIFIED_TARGET`; destructive database outage was intentionally not induced. |
| T0-RAG-01 | Meaningful zero-overlap queries returned arbitrary zero-score fact cards. Baseline `0db6300` (E2). | `7d58506`, `f33aa88` | Irrelevant, stop-word-only, Bengali, and injection-like queries return no rows; empty/punctuation structured browsing remains available. | `VERIFIED_TARGET` through Droplet 58/58 and public grounded plan. |
| T0-GROUND-01 | Crop results lacked a complete deterministic rationale and model-loop failure aborted the plan. Baseline `0db6300` (E1/E2). | `7d58506` | All crops expose profile/weather/RAG/penalty/assumption inputs; injected failure recovers; public trace selected all five tools. | `VERIFIED_TARGET`; provider failure remains safely injected. |
| T0-UX-01 | Demo sessions could reuse state; initial status overstated weather readiness; accessibility/mobile contracts were incomplete. Baseline `7d58506` (E1/E2). | `9e416b3` | Nine UI contracts, Chrome DOM, visible Computer Use, and 320/360/375 no-overflow probes. | `VERIFIED_TARGET`; mounted UI regression tests remain a maintainability improvement. |
| T0-REL-01 | Health did not identify the deployed source revision. Baseline `0db6300` (E1). | `9eac23c` | Revision tests plus GitHub/Droplet/PM2/public-health SHA equality. | `VERIFIED_TARGET`. |

## Review decisions

- Kawsar's screenshot was treated as a lead, not proof. Its useful claims were independently verified against the repository before patching.
- No extra BARC scraping was performed. The existing nine-dataset corpus and focused retrieval tests were sufficient for these confirmed root causes.
- Tier 1/2, bdapps integration, architectural replacement, and new external data ingestion remain out of the Tier 0 release scope.

## Final release gates

All Tier 0 release gates passed. Remaining work is intentionally deferred: mounted React interaction tests, one destructive database-outage exercise in a disposable target, seasonal Rabi weather revalidation, Tier 1/2, and bdapps.
