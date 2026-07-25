import test from "node:test";
import assert from "node:assert/strict";

import { isDirectAssistanceRequest } from "../server/intents.js";

test("urgent, image-help, and voice requests bypass farm-profile extraction", () => {
  assert.equal(isDirectAssistanceRequest("My area is flooding. What should I do?"), true);
  assert.equal(isDirectAssistanceRequest("I want to upload a picture of a diseased leaf"), true);
  assert.equal(isDirectAssistanceRequest("Can I talk to the Bangla voice AI?"), true);
  assert.equal(isDirectAssistanceRequest("amar elakay bonna, ekhon ki korbo"), true);
});

test("farm facts still go through intelligent profile extraction", () => {
  assert.equal(isDirectAssistanceRequest("I have 10 acres in Pabna and BDT 50000"), false);
});
