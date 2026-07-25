import assert from "node:assert/strict";
import test from "node:test";

import { createPaymentStatusHandler, createSubscriptionCancelHandler } from "../server/payment-http.js";

function responseRecorder() {
  return {
    statusCode: 200,
    payload: null,
    status(value) {
      this.statusCode = value;
      return this;
    },
    json(value) {
      this.payload = value;
      return this;
    },
  };
}

test("payment status handler returns only the safe public service view", async () => {
  const response = responseRecorder();
  const handler = createPaymentStatusHandler({
    health: async () => ({
      available: true,
      service: "agrisense-bdapps",
      provider: "bdapps",
      dashboardUrl: "https://rookiecoders.tech/payments/",
      latencyMs: 31,
      adminToken: "must-not-leak",
    }),
  });

  await handler({}, response);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.payload, {
    available: true,
    service: "agrisense-bdapps",
    provider: "bdapps",
    latencyMs: 31,
  });
});

test("payment status failure remains recoverable and opaque", async () => {
  const response = responseRecorder();
  const handler = createPaymentStatusHandler({
    health: async () => {
      throw new Error("postgres://secret:secret@database");
    },
  });

  await handler({}, response);

  assert.equal(response.statusCode, 503);
  assert.deepEqual(response.payload, {
    available: false,
    provider: "bdapps",
    error: "Payment service is temporarily unavailable.",
    recoverable: true,
  });
});

test("subscription cancellation resolves the encrypted session subscriber server-side", async () => {
  const response = responseRecorder();
  let cancelledMobile;
  const handler = createSubscriptionCancelHandler({
    authService: { getSubscriber: async (token) => token === "session-token" ? "8801845082101" : null },
    gateway: {
      async cancelSubscription(mobile) {
        cancelledMobile = mobile;
        return { cancelled: true };
      },
    },
  });
  const request = { headers: { cookie: "agrisense_session=session-token" } };

  await handler(request, response);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.payload, { cancelled: true, subscriptionStatus: "CANCELLED" });
  assert.equal(cancelledMobile, "8801845082101");
  assert.equal(JSON.stringify(response.payload).includes("8801845082101"), false);
});
