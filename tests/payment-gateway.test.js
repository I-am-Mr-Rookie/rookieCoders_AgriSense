import assert from "node:assert/strict";
import test from "node:test";

import {
  PaymentGatewayError,
  createPaymentGateway,
  normalizePaymentGatewayConfig,
} from "../server/payment-gateway.js";

test("normalizes the production payment URLs without exposing an operator token", () => {
  assert.deepEqual(
    normalizePaymentGatewayConfig({
      serviceUrl: "https://rookiecoders.tech/api/bdapps/",
      dashboardUrl: "https://rookiecoders.tech/payments/",
    }),
    {
      serviceUrl: "https://rookiecoders.tech/api/bdapps",
      dashboardUrl: "https://rookiecoders.tech/payments/",
    },
  );

  assert.throws(
    () => normalizePaymentGatewayConfig({
      serviceUrl: "http://payments.example.com/api/bdapps",
      dashboardUrl: "https://payments.example.com/",
    }),
    /HTTPS/,
  );
});

test("checks the public health endpoint without forwarding secrets", async () => {
  let request;
  const gateway = createPaymentGateway({
    serviceUrl: "https://rookiecoders.tech/api/bdapps",
    dashboardUrl: "https://rookiecoders.tech/payments/",
    now: (() => {
      const values = [100, 143];
      return () => values.shift();
    })(),
    fetchImpl: async (url, options) => {
      request = { url, options };
      return {
        ok: true,
        status: 200,
        json: async () => ({ status: "ok", service: "agrisense-bdapps" }),
      };
    },
  });

  const status = await gateway.health();

  assert.equal(request.url, "https://rookiecoders.tech/api/bdapps/health");
  assert.equal(request.options.method, "GET");
  assert.equal(request.options.headers.authorization, undefined);
  assert.deepEqual(status, {
    available: true,
    service: "agrisense-bdapps",
    provider: "bdapps",
    dashboardUrl: "https://rookiecoders.tech/payments/",
    latencyMs: 43,
  });
});

test("returns a sanitized typed failure when the gateway is unavailable", async () => {
  const gateway = createPaymentGateway({
    serviceUrl: "https://rookiecoders.tech/api/bdapps",
    dashboardUrl: "https://rookiecoders.tech/payments/",
    fetchImpl: async () => ({
      ok: false,
      status: 502,
      json: async () => ({ error: "database password=never-return-this" }),
    }),
  });

  await assert.rejects(
    gateway.health(),
    (error) => {
      assert.equal(error instanceof PaymentGatewayError, true);
      assert.equal(error.status, 503);
      assert.equal(error.message, "Payment gateway health check failed.");
      assert.equal(JSON.stringify(error).includes("never-return-this"), false);
      return true;
    },
  );
});

test("cancels only the supplied subscriber through the protected operator route", async () => {
  let request;
  const gateway = createPaymentGateway({
    serviceUrl: "https://rookiecoders.tech/api/bdapps",
    dashboardUrl: "https://rookiecoders.tech/payments/",
    adminToken: "operator-secret",
    fetchImpl: async (url, options) => {
      request = { url, options };
      return {
        ok: true,
        status: 200,
        json: async () => ({ statusCode: "S1000", statusDetail: "Success" }),
      };
    },
  });

  assert.deepEqual(await gateway.cancelSubscription("8801845082101"), { cancelled: true });
  assert.equal(request.url, "https://rookiecoders.tech/api/bdapps/subscription/unsubscribe");
  assert.equal(request.options.headers.authorization, "Bearer operator-secret");
  assert.deepEqual(JSON.parse(request.options.body), { mobile: "8801845082101" });
});

test("daily charge uses the protected idempotent direct-debit contract", async () => {
  let request;
  const gateway = createPaymentGateway({
    serviceUrl: "https://rookiecoders.tech/api/bdapps",
    dashboardUrl: "https://rookiecoders.tech/payments/",
    adminToken: "operator-secret",
    fetchImpl: async (url, options) => {
      request = { url, options };
      return {
        ok: true,
        status: 200,
        json: async () => ({ statusCode: "S1000", transactionState: "SUCCEEDED" }),
      };
    },
  });
  const result = await gateway.chargeDaily({
    mobile: "8801845082101",
    amount: "5.00",
    externalTrxId: "agri_123456789abc_20260725",
  });
  assert.equal(result.transactionState, "SUCCEEDED");
  assert.equal(request.url, "https://rookiecoders.tech/api/bdapps/caas/direct-debit");
  assert.deepEqual(JSON.parse(request.options.body), {
    mobile: "8801845082101",
    amount: "5.00",
    externalTrxId: "agri_123456789abc_20260725",
    confirmCharge: true,
  });
});
