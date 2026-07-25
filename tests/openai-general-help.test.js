import test from "node:test";
import assert from "node:assert/strict";

import { answerGeneralFarmerQuestion } from "../server/openai.js";

test("flood fallback gives immediate safety actions when the model is unavailable", async () => {
  const answer = await answerGeneralFarmerQuestion({
    message: "My area is flooding. What should I do right now?",
    responseLanguage: "English",
  }, null);

  assert.match(answer, /higher ground/i);
  assert.match(answer, /electric/i);
  assert.match(answer, /district/i);
});

test("image and voice fallbacks point to the matching agent controls", async () => {
  const image = await answerGeneralFarmerQuestion({
    message: "My plant looks diseased",
    responseLanguage: "English",
  }, null);
  const voice = await answerGeneralFarmerQuestion({
    message: "I want to talk to the voice AI",
    responseLanguage: "English",
  }, null);

  assert.match(image, /Attach leaf/);
  assert.match(voice, /Bangla voice/);
});
