# AgriSense Tier 0 — Current Progress

**As of:** 24 July 2026, 21:08 Asia/Dhaka

**Repository:** <https://github.com/I-am-Mr-Rookie/rookieCoders_AgriSense>

**Status:** local Tier 0 implementation, medium evaluation, and live GPT-5.6 Sol probe pass; DigitalOcean deployment and PostgreSQL verification remain pending.

## Executive verdict

The starting `T0-Initial` was roughly **38% of a defensible Tier 0**: the vertical slice built and six tests passed, but its four static knowledge cards did not constitute the supplied RAG corpus and GPT-5.6 Sol did not choose tools.

The current revision covers all eight Tier 0 product surfaces locally:

| Requirement | Current evidence |
|---|---|
| Targeted intake | Six required fields; only missing fields are requested. |
| Live weather | Open-Meteo seven-day Bangladesh forecast feeds ranking. |
| Three or more crops | Four Rabi crops ranked from profile, weather, finance, and BARC zoning. |
| Season plan | Six dated checkpoints from land preparation through harvest. |
| Financials | Itemized cost, yield, revenue, profit, ROI, and break-even. |
| Explained reasoning | Sol tool loop when configured; labeled deterministic explanation otherwise. |
| RAG affects advice | 1,976 indexed fact cards across nine datasets; BARC zoning is blended into crop scores and retrieved records attach to plan stages. |
| Visible trace | Parameters, results, timestamps, durations, RAG actions, and model-selected tool calls are shown. |

## Verification

`npm.cmd run check` passed:

- 15 tests, 15 passed, 0 failed;
- production Vite build passed;
- tool-loop tests cover allow-listing, duplicate rejection, call limits, reasoning/function output round trips, and secret redaction;
- RAG tests cover all nine datasets, blocked-row exclusion, Gazipur mustard provenance, bounded scoring, plan evidence, and instruction-like source text.

Medium HTTP evaluation passed without local secrets:

```json
{"health":true,"phase":"Tier-0","indexed":1976,"datasets":9,"best":"Maize","score":74,"ragScore":43.6,"crops":4,"stages":6,"citations":6,"trace":5,"assumptions":1,"evidenceStages":5,"weatherSource":"Open-Meteo"}
```

The live weather response is time-sensitive. A separate bounded server-side probe used the supplied OpenAI key transiently and passed: `gpt-5.6-sol` at medium effort selected all five required read-only tools (`inspect_weather`, `inspect_rag_evidence`, `inspect_ranked_crops`, `inspect_season_plan`, and `inspect_financials`) before returning its explanation. No key value was printed, traced, copied into the client, or committed.

## Truth boundaries

- Crop base coefficients, production costs, yields, prices, and default checkpoint offsets remain team assumptions.
- BARC crop zoning, FRG nutrient facts, BAMIS/DAE pest/calendar records, and other supplied structured records retain their provenance and confidence warnings.
- Calendar coverage is partial; the corpus does not justify exact stage dates for every crop/location.
- Chemical pesticide advice is intentionally omitted without current DAE registry evidence.
- This is Tier 0 only. Tier 1, Tier 2, bdapps payment, image diagnosis, marketplace, Bengali voice, and proactive alerts are deferred.

## Remaining gates

1. Run the exact revision on DigitalOcean.
2. Verify PostgreSQL persistence.
3. Run one public health check and one complete Gazipur flow.
4. Record deployed URL and SHA, then push the verified commit.

See `evaluation.html` for the judge-facing self-test and `final plan.html` for the validated execution handoff.
