import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const serverSource = readFileSync(new URL("../server/index.js", import.meta.url), "utf8");
const openAiSource = readFileSync(new URL("../server/openai.js", import.meta.url), "utf8");
const packageSource = readFileSync(new URL("../package.json", import.meta.url), "utf8");

test("server wires bounded Tier 2 market, image, and Realtime routes", () => {
  for (const expected of [
    'app.post("/api/tier2/market"',
    'app.post("/api/tier2/disease"',
    'app.post("/api/realtime/client-secret"',
    'express.json({ limit: "7mb" })',
    "createMarketIntelligenceService",
    "createDiseaseDiagnosisService",
    "createRealtimeService",
    "createTier2Handlers",
  ]) {
    assert.ok(serverSource.includes(expected), `missing Tier 2 server contract: ${expected}`);
  }
  assert.ok(
    serverSource.indexOf('app.post("/api/tier2/disease"')
      < serverSource.indexOf('app.use(express.json({ limit: "64kb" }))'),
    "large image parser must be route-scoped before the default 64kb parser",
  );
});

test("health advertises implemented Tier 2 and payment capabilities", () => {
  for (const expected of [
    'phase: "Tier-2"',
    "marketIntelligence: true",
    "imageDiagnosis: true",
    "realtimeVoice: true",
  ]) {
    assert.ok(serverSource.includes(expected), `missing health capability: ${expected}`);
  }
  assert.equal(serverSource.includes("paymentGateway: true"), true);
});

test("OTP verification accepts a bounded standard form for tab-loss recovery", () => {
  assert.ok(serverSource.includes('express.urlencoded({ extended: false, limit: "4kb" })'));
  assert.ok(serverSource.includes('app.post("/api/auth/otp/verify", otpFormParser, authHandlers.verifyOtp)'));
});

test("documented OpenAI model replaces the private model-name default", () => {
  assert.ok(openAiSource.includes('process.env.OPENAI_MODEL || "gpt-5.6"'));
  assert.equal(openAiSource.includes('"gpt-5.6-sol"'), false);
  assert.ok(packageSource.includes("--env-file-if-exists=.env"));
});
