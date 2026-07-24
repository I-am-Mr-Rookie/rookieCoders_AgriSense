# AgriSense Tier 0 Readiness Closure Design

**Date:** 24 July 2026  
**Deadline mode:** Compression, then freeze by 22:15 Asia/Dhaka  
**Target:** 100% coverage of the eight official Tier 0 acceptance gates with executable evidence. This is not a promise of 100/100 organizer points.

## Role Stack

- **Primary role:** AgriSense Tier 0 Implementation and Delivery Lead.
- **Domain role:** React/Express/OpenAI/PostgreSQL reliability engineer.
- **Validation role:** Official-contract, browser-demo, regression, secret-safety, and release auditor.

## Authority

1. Koushik's active instructions and this approved closure design.
2. `Agentic_AI_Hackathon_Final_Question.pdf`.
3. Executed local, browser, production, Git, and deployment evidence.
4. The validated `final plan.html` handoff.
5. Kawsar's screenshot and sibling implementation as candidate evidence only.

## Alternatives Considered

1. **Evidence-closure sprint — selected.** Preserve the working architecture, reproduce gaps, patch only confirmed Tier 0 failures, and complete browser/deployment evidence.
2. **Full model-orchestration rewrite — rejected for this deadline.** It may improve agentic optics but creates unacceptable regression and cost risk.
3. **Agronomy/RAG expansion — deferred.** It may improve practical depth, but embeddings and new data cannot be truthfully integrated and evaluated inside the remaining window.

## Confirmed Baseline

- The official eight-capability Tier 0 API path exists.
- Local baseline: 17/17 tests and Vite production build pass.
- Production baseline: PostgreSQL, `gpt-5.6-sol/high`, nine datasets, and 1,976 indexed fact cards.
- A two-message vague free-text production flow correctly retained the first profile patch, requested only the three missing fields, then returned four crops, six stages, six citations, ten trace entries, and all five model-selected inspection tools.
- Local `main` and `origin/main` match at `30e83173eae0fa6b68624baccd257536d7101f08`.
- The rendered success path has a response-contract defect: the server returns the explanation object as `assistant`, while React renders `data.assistant` as text.
- Evidence documents contain stale test counts, revision claims, and pre-deployment cautions.

## Kawsar Candidate Report

The screenshot claims that a sibling version has hybrid BM25 plus OpenAI embeddings over 3,090 documents and a 64-district/Bengali alias extractor.

- Hybrid embeddings are `HARDENING_ONLY` for Tier 0 unless a frozen retrieval probe shows the current corpus cannot ground the required advice. They will not be added in this closure.
- District/Bengali alias normalization may be adopted only if a focused probe reproduces a real location or retrieval miss and the fix is a small deterministic adapter with regression coverage.
- Claims, document counts, and quality advantages from the screenshot are not accepted without executable evidence.

## Patch Design

1. Normalize the completed-plan response contract so `assistant` is always a string. Keep structured explanation metadata in a separate field if needed.
2. Defensively normalize client rendering so an unexpected response shape produces text or a controlled error, never a React crash.
3. Add regression coverage for the completed-plan response/UI contract at the smallest testable boundary.
4. Add only high-value bounded probes that fit the freeze window:
   - vague and partial intake;
   - invalid or unsupported location;
   - financial scaling;
   - dry/wet ranking change;
   - RAG grounding and instruction-like source text;
   - tool allow-list, duplicate rejection, call limit, and redaction;
   - browser demo and visible natural-language completion.
5. Update `evaluation.html`, `currentprogress.md`, `README.md`, and the re-engineered handoff with exact post-patch evidence and honest limitations.
6. Deploy only the exact tested commit, then prove browser behavior, health, PostgreSQL continuity, local/remote/Droplet SHA equality, and secret-scan cleanliness.

## Error and Recovery Behavior

- Provider, weather, and database failures must render a recoverable user-facing message without a React crash or credential leakage.
- No schema, endpoint, deployment target, database, or credential changes outside the minimum patch.
- If a new probe fails after 22:15, freeze features, retain the last verified revision, and report the exact blocker.
- Do not delete the untracked `roadmap-t0.html`, server backup branch, data, scripts, or infrastructure.

## Fixed Evaluation-Patch Loop

In a step-by-step logical process:

1. Freeze the criteria and baseline above.
2. Reproduce each candidate before classifying it `CONFIRMED`.
3. Patch the smallest root cause.
4. Run the focused probe.
5. Run the unchanged 17-test suite and production build.
6. Run the same production/browser case plus one adversarial case.
7. Re-score evidence coverage and execution readiness without changing weights.
8. Update evidence artifacts, commit, push, deploy, and read back exact revisions only after all mandatory gates pass.

## Acceptance Gates

- All eight official Tier 0 capabilities have current E2-E4 evidence.
- The completed browser demo and natural-language path render without console/runtime errors.
- The model-selected tool trace is visible and secret-redacted.
- Local tests/build pass after the patch.
- Production health and a full flow pass on the exact deployed revision.
- PostgreSQL retains a partial session across a process restart if the restart probe is safe within the freeze window.
- Tracked source and built client pass secret-shaped-value scans.
- Local, GitHub, and Droplet revisions match.
- Evidence artifacts contain no stale pre-deployment claims.
- Tier 1, Tier 2, bdapps, embeddings, and broad RAG expansion remain deferred.

