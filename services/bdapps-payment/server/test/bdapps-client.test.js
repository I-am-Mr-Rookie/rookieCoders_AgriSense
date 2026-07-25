import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { BdappsClient, BdappsError } from "../src/bdapps-client.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function client(overrides = {}) {
  return new BdappsClient({
    baseUrl: "https://developer.bdapps.com",
    applicationId: "APP_secret_id",
    password: "super-secret-password",
    ...overrides
  });
}

test("balance uses the current endpoint and MobileAccount", async () => {
  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push({ url, body: JSON.parse(options.body) });
    return new Response(JSON.stringify({ statusCode: "S1000", balance: "10.00" }), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  };
  const result = await client().queryBalance({ subscriberId: "tel:8801845082101" });
  assert.equal(result.balance, "10.00");
  assert.equal(requests[0].url, "https://developer.bdapps.com/caas/get/balance");
  assert.equal(requests[0].body.paymentInstrumentName, "MobileAccount");
});

test("balance falls back only when the current endpoint is unavailable", async () => {
  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push({ url, body: JSON.parse(options.body) });
    if (requests.length === 1) {
      return new Response(JSON.stringify({ statusDetail: "Not found" }), {
        status: 404,
        headers: { "content-type": "application/json" }
      });
    }
    return new Response(JSON.stringify({ statusCode: "S1000" }), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  };
  await client().queryBalance({ subscriberId: "tel:8801845082101" });
  assert.deepEqual(requests.map((entry) => entry.url), [
    "https://developer.bdapps.com/caas/get/balance",
    "https://developer.bdapps.com/caas/balance/query"
  ]);
  assert.equal(requests[1].body.paymentInstrumentName, "Mobile Account");
});

test("non-JSON diagnostics redact credentials", async () => {
  globalThis.fetch = async () => new Response(
    "<html>APP_secret_id super-secret-password upstream error</html>",
    { status: 502, headers: { "content-type": "text/html" } }
  );
  await assert.rejects(
    () => client().queryBalance({ subscriberId: "tel:8801845082101" }),
    (error) => {
      assert.ok(error instanceof BdappsError);
      assert.equal(error.httpStatus, 502);
      assert.doesNotMatch(error.bodyPreview, /APP_secret_id|super-secret-password/);
      assert.match(error.bodyPreview, /\[redacted\]/);
      return true;
    }
  );
});

test("direct debit makes one attempt and marks transport failure as unknown", async () => {
  let attempts = 0;
  globalThis.fetch = async () => {
    attempts += 1;
    throw new Error("timeout");
  };
  await assert.rejects(
    () => client().directDebit({ externalTrxId: "1234567890abcdef1234567890abcdef", subscriberId: "tel:8801845082101", amount: "1.00" }),
    (error) => error instanceof BdappsError && error.outcomeUnknown === true
  );
  assert.equal(attempts, 1);
});

test("direct debit uses the portal payment instrument name", async () => {
  let requestBody;
  globalThis.fetch = async (_url, options) => {
    requestBody = JSON.parse(options.body);
    return new Response(JSON.stringify({ statusCode: "S1000" }), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  };
  await client().directDebit({
    externalTrxId: "abcdef1234567890abcdef1234567890",
    subscriberId: "tel:8801845082101",
    amount: "5.00"
  });
  assert.equal(requestBody.paymentInstrumentName, "Mobile Account");
});
