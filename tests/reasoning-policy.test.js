import test from "node:test";
import assert from "node:assert/strict";

import { selectReasoningEffort } from "../server/openai.js";

test("uses medium reasoning for routine farm planning", () => {
  assert.equal(selectReasoningEffort("Plan my Gazipur maize farm."), "medium");
  assert.equal(selectReasoningEffort(""), "medium");
  assert.equal(selectReasoningEffort("Plan my Gazipur maize farm.", "high"), "medium");
  assert.equal(selectReasoningEffort("x".repeat(1200), "high"), "medium");
});

test("uses high reasoning only for named hard-case patterns", () => {
  assert.equal(selectReasoningEffort("What if rainfall drops 30% and my budget is cut 40%?"), "high");
  assert.equal(selectReasoningEffort("Compare the trade-offs between maize and mustard."), "high");
  assert.equal(selectReasoningEffort("Optimize four crop plans under rainfall, price, and budget uncertainty."), "high");
});
