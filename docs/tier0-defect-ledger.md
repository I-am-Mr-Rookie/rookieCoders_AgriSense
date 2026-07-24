# AgriSense Tier 0 Defect Ledger

Frozen on 24 July 2026 for the 95/100 release-readiness campaign. Evidence levels are: E1 static inspection, E2 focused executable probe, E3 regression/integration, and E4 clean-target end to end.

| ID | Root cause and baseline | Fix commits | Regression evidence | State / residual risk |
|---|---|---|---|---|
| T0-VAL-01 | Intake accepted unsupported values and non-Bangladesh locations; dependency failures could expose raw messages. Baseline `cbb0450` (E1/E2). | `669571d`, `584810f`, `0db6300`, `773550b` | Canonical district/adversarial validation and focused recovery/RAG suites; final merged suite 58/58. | `FIXED_LOCAL`; HTTP and production probes pending. |
| T0-PERSIST-01 | A failed initial database save was incorrectly described as safely persisted. Baseline `584810f` (E1/E2). | `0db6300` | Injected initial-save and downstream-failure probes distinguish the two public messages and keep internals out of the payload. | `FIXED_LOCAL`; restart persistence proof pending. |
| T0-RAG-01 | Meaningful zero-overlap queries returned arbitrary zero-score fact cards. Baseline `0db6300` (E2). | `7d58506`, `f33aa88` | Irrelevant, stop-word-only, Bengali, and injection-like queries return no rows; empty/punctuation structured browsing remains available. | `FIXED_LOCAL`; live target probe pending. |
| T0-GROUND-01 | Crop results lacked a complete deterministic rationale and model-loop failure aborted the plan. Baseline `0db6300` (E1/E2). | `7d58506` | All four crops expose profile/weather/RAG/penalty/assumption inputs; injected model failure produces sanitized deterministic recovery. | `FIXED_LOCAL`; one live model-selected trace pending. |
| T0-UX-01 | Demo sessions could reuse state; initial status overstated weather readiness; accessibility/mobile contracts were incomplete. Baseline `7d58506` (E1/E2). | `9e416b3` | Nine session/UI contracts pass; production build passes. | `FIXED_LOCAL`; 320/360/375 browser geometry and visible judge path pending. |
| T0-REL-01 | Health did not identify the deployed source revision. Baseline `0db6300` (E1). | `9eac23c` | Revision helper and health wiring tests pass. | `FIXED_LOCAL`; exact public SHA and PM2 restart proof pending. |

## Review decisions

- Kawsar's screenshot was treated as a lead, not proof. Its useful claims were independently verified against the repository before patching.
- No extra BARC scraping was performed. The existing nine-dataset corpus and focused retrieval tests were sufficient for these confirmed root causes.
- Tier 1/2, bdapps integration, architectural replacement, and new external data ingestion remain out of the Tier 0 release scope.

## Final release gates

1. Preserve the approved strict-district and Unicode retrieval follow-ups.
2. Run the full local test/build and whitespace/secret gates.
3. Push the exact commit, verify a fresh clone, and deploy the same SHA.
4. Prove invalid input, retry persistence, model tool trace, mobile geometry, console cleanliness, and visible judge flow on the public target.
5. Score once from executed evidence; do not round up.
