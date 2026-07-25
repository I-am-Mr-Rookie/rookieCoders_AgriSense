import assert from "node:assert/strict";
import test from "node:test";

import { LANGUAGES, responseLanguageName, t } from "../src/i18n.js";

test("offers only English and Bangla language modes", () => {
  assert.deepEqual(LANGUAGES.map((entry) => entry.value), ["en", "bn"]);
  assert.equal(JSON.stringify(LANGUAGES).includes("Banglish"), false);
});

test("Bangla generation guidance asks for natural concise Bangladesh usage", () => {
  const guidance = responseLanguageName("bn");
  assert.match(guidance, /natural, concise Bangla/i);
  assert.match(guidance, /Bangladesh/i);
  assert.match(guidance, /avoid word-for-word translation/i);
  assert.equal(t("bn", "logout"), "বের হোন");
  assert.equal(t("banglish", "send"), "Send");
});
