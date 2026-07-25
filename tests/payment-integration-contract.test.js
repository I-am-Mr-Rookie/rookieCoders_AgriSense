import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const appSource = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const serverSource = readFileSync(new URL("../server/index.js", import.meta.url), "utf8");
const stylesSource = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
const paymentCardSource = readFileSync(new URL("../src/components/PaymentGatewayCard.jsx", import.meta.url), "utf8");
const i18nSource = readFileSync(new URL("../src/i18n.js", import.meta.url), "utf8");

test("server exposes farmer subscription status and authenticated cancellation", () => {
  for (const expected of [
    'app.get("/api/payments/status"',
    'app.post("/api/subscription/cancel"',
    "createPaymentGateway",
    "createPaymentStatusHandler",
    "paymentGateway: true",
  ]) {
    assert.ok(serverSource.includes(expected), `missing payment server contract: ${expected}`);
  }

  assert.equal(serverSource.includes("/api/payments/direct-debit"), false);
});

test("farmer workspace shows one-time BDT 5 prototype access without recurring controls", () => {
  for (const expected of [
    'fetch("/api/payments/status"',
    "PaymentGatewayCard",
    "One-time BDT 5",
    "Future logins use your password",
  ]) {
    assert.ok(`${appSource}\n${paymentCardSource}\n${i18nSource}`.includes(expected), `missing payment UI contract: ${expected}`);
  }

  assert.equal(appSource.includes("PAYMENT_ADMIN_TOKEN"), false);
  assert.equal(appSource.includes("confirmCharge"), false);
  assert.equal(appSource.includes("Charge subscriber"), false);
  assert.equal(paymentCardSource.includes("dashboardUrl"), false);
  assert.equal(paymentCardSource.includes("Open secure payment operations"), false);
  assert.equal(paymentCardSource.includes("cancel-subscription"), false);
  assert.ok(stylesSource.includes(".payment-gateway-card"));
});

test("prototype server cannot re-enable recurring daily charges from a stale environment flag", () => {
  assert.ok(serverSource.includes("enabled: false"));
  assert.equal(serverSource.includes('process.env.DAILY_BILLING_ENABLED === "true"'), false);
});

test("farmer client contains no dormant recurring-subscription workflow", () => {
  assert.equal(appSource.includes('fetch("/api/subscription/cancel"'), false);
  assert.equal(appSource.includes("cancellingSubscription"), false);
  assert.equal(i18nSource.includes("Stop future AgriSense daily charges"), false);
});
