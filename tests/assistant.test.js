import test from "node:test";
import assert from "node:assert/strict";

import { assistantText } from "../shared/assistant.js";

test("returns a non-empty string unchanged", () => {
  assert.equal(assistantText("Mustard is the best fit."), "Mustard is the best fit.");
});

test("returns non-empty text from an assistant response object", () => {
  assert.equal(assistantText({ text: "Mustard is the best fit." }), "Mustard is the best fit.");
});

test("falls back when an assistant response object has no readable text", () => {
  assert.equal(assistantText({}), "AgriSense returned an unreadable response.");
});
