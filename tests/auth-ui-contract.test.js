import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const appSource = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const landingSource = readFileSync(new URL("../src/components/LandingPage.jsx", import.meta.url), "utf8");
const authSource = readFileSync(new URL("../src/components/AuthDialog.jsx", import.meta.url), "utf8");
const i18nSource = readFileSync(new URL("../src/i18n.js", import.meta.url), "utf8");

test("public landing has only the requested entry actions", () => {
  for (const text of ["Sign up", "Login", "GitHub", "8801845082101"]) {
    assert.ok(`${landingSource}\n${authSource}\n${i18nSource}`.includes(text), `missing landing/auth contract: ${text}`);
  }
  assert.ok(landingSource.includes("landing-field-orbit"));
  assert.ok(landingSource.includes("I-am-Mr-Rookie/rookieCoders_AgriSense"));
  for (const language of ["English", "বাংলা"]) assert.ok(i18nSource.includes(language));
  assert.equal(i18nSource.includes("Banglish"), false);
});

test("agent workspace is gated by server-restored authentication", () => {
  for (const text of [
    'fetch("/api/auth/session"',
    "LandingPage",
    "AuthDialog",
    "authState.authenticated",
    'fetch("/api/auth/logout"',
    "VoiceOrb",
  ]) {
    assert.ok(appSource.includes(text), `missing authenticated app contract: ${text}`);
  }
  assert.equal(appSource.includes("PAYMENT_ADMIN_TOKEN"), false);
  assert.equal(appSource.includes("OPENAI_API_KEY"), false);
});

test("profile settings hide explicit account deletion behind confirmation", () => {
  for (const text of [
    'fetch("/api/auth/account"',
    'method: "DELETE"',
    "showAccountSettings",
    "confirmAccountDeletion",
    "Delete account",
  ]) assert.ok(appSource.includes(text), `missing account deletion contract: ${text}`);
});

test("OTP dialog presents safe provider diagnostics when enrollment is rejected", () => {
  assert.ok(authSource.includes("data.providerCode"));
  assert.ok(authSource.includes("data.providerDetail"));
  assert.equal(authSource.includes("bodyPreview"), false);
  assert.equal(authSource.includes("applicationHash"), false);
});

test("signup requires explicit BDT 5 daily-charge consent while login does not", () => {
  assert.ok(authSource.includes("dailyChargeConsent"));
  assert.ok(authSource.includes('mode === "signup"'));
  assert.ok(authSource.includes("!chargeConsent"));
  assert.ok(authSource.includes("BDT 5"));
  assert.ok(authSource.includes("৫ টাকা"));
});
