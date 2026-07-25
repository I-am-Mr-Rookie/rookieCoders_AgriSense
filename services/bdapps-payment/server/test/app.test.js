import assert from "node:assert/strict";
import { test } from "node:test";
import { createApp } from "../src/app.js";
import { BdappsError } from "../src/bdapps-client.js";
import { toSubscriberId } from "../src/phone.js";

const ADMIN_TOKEN = "test-operator-token-with-at-least-32-characters";
const MOBILE = "01845082101";

function createHarness(overrides = {}) {
  const calls = [];
  const events = [];
  const transactions = new Map();

  const repository = {
    async health() {},
    async recordEvent(type, payload) { events.push({ type, payload }); },
    async saveOtpRequest() {},
    async markOtpVerified() {},
    async getDashboardSummary() {
      return {
        totalTransactions: transactions.size,
        succeededTransactions: 0,
        failedTransactions: 0,
        unknownTransactions: 0,
        pendingTransactions: 0,
        succeededAmount: "0",
        lastTransactionAt: null,
        totalEvents: events.length,
        lastEventAt: null
      };
    },
    async listTransactions() { return { rows: [...transactions.values()], total: transactions.size }; },
    async listEvents() { return { rows: events, total: events.length }; },
    async createPendingTransaction(payload) {
      calls.push({ operation: "insert", payload });
      if (transactions.has(payload.externalTrxId)) return false;
      transactions.set(payload.externalTrxId, { ...payload, state: "PENDING", attemptCount: 1 });
      return true;
    },
    async completeTransaction(payload, response, state) {
      calls.push({ operation: "complete", state });
      transactions.set(payload.externalTrxId, { ...payload, ...response, state, attemptCount: 1 });
    },
    async markTransactionUnknown(externalTrxId, error) {
      calls.push({ operation: "unknown" });
      transactions.set(externalTrxId, {
        ...transactions.get(externalTrxId),
        state: "UNKNOWN",
        lastError: error.message,
        attemptCount: 1
      });
    },
    async getTransaction(externalTrxId) { return transactions.get(externalTrxId) ?? null; }
  };

  const bdapps = {
    async sendSms(payload) { calls.push({ operation: "sms", payload }); return { statusCode: "S1000" }; },
    async requestOtp(payload) { calls.push({ operation: "otp-request", payload }); return { statusCode: "S1000", referenceNo: "123" }; },
    async verifyOtp() { return { statusCode: "S1000", subscriptionStatus: "REGISTERED" }; },
    async getSubscriptionStatus() { calls.push({ operation: "subscription" }); return { subscriptionStatus: "REGISTERED" }; },
    async setSubscription() { return { statusCode: "S1000" }; },
    async sendUssd() { return { statusCode: "S1000" }; },
    async queryBalance() { return { statusCode: "S1000" }; },
    async listPaymentInstruments() { return { statusCode: "S1000" }; },
    async directDebit(payload) {
      calls.push({ operation: "debit", payload });
      return { statusCode: "S1000", statusDetail: "Success", internalTrxId: "internal-1" };
    },
    ...overrides.bdapps
  };

  return { repository: { ...repository, ...overrides.repository }, bdapps, calls, events, transactions };
}

async function withServer(harness, callback, options = {}) {
  const server = createApp({
    bdapps: harness.bdapps,
    repository: harness.repository,
    adminToken: ADMIN_TOKEN,
    minChargeAmount: options.minChargeAmount || "5.00",
    maxChargeAmount: options.maxChargeAmount || "100.00",
    caasSubscriptionRequired: options.caasSubscriptionRequired || false
  }).listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  try {
    await callback(baseUrl);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

async function request(baseUrl, path, body, token = ADMIN_TOKEN) {
  const headers = {};
  if (body !== undefined) headers["content-type"] = "application/json";
  if (token !== null) headers.authorization = `Bearer ${token}`;
  return fetch(`${baseUrl}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
}

test("normalizes supported Bangladesh mobile formats", () => {
  assert.equal(toSubscriberId("01812345678"), "tel:8801812345678");
  assert.equal(toSubscriberId("+8801812345678"), "tel:8801812345678");
  assert.equal(toSubscriberId("8801845082101"), "tel:8801845082101");
});

test("operator routes reject missing authorization before provider calls", async () => {
  const harness = createHarness();
  await withServer(harness, async (baseUrl) => {
    const response = await request(baseUrl, "/api/bdapps/subscription/status", { mobile: MOBILE }, null);
    assert.equal(response.status, 401);
    assert.equal(response.headers.get("www-authenticate"), 'Bearer realm="agrisense-payment"');
    assert.equal(harness.calls.length, 0);
  });
});

test("dashboard routes return paginated database records", async () => {
  const observed = {};
  const harness = createHarness({
    repository: {
      async getDashboardSummary() {
        return { totalTransactions: 7, succeededTransactions: 5, failedTransactions: 1, unknownTransactions: 1, pendingTransactions: 0, succeededAmount: "25.00", totalEvents: 3 };
      },
      async listTransactions(options) {
        observed.transactions = options;
        return { rows: [{ externalTrxId: "abcdef1234567890abcdef1234567890", state: "SUCCEEDED" }], total: 7 };
      },
      async listEvents(options) {
        observed.events = options;
        return { rows: [{ id: 11, eventType: "caas.notification" }], total: 3 };
      }
    }
  });
  await withServer(harness, async (baseUrl) => {
    const summaryResponse = await request(baseUrl, "/api/bdapps/dashboard/summary");
    assert.equal(summaryResponse.status, 200);
    assert.equal((await summaryResponse.json()).summary.succeededAmount, "25.00");

    const transactionsResponse = await request(baseUrl, "/api/bdapps/caas/transactions?limit=20&offset=40&state=succeeded&query=88018");
    assert.equal(transactionsResponse.status, 200);
    const transactionsBody = await transactionsResponse.json();
    assert.equal(transactionsBody.total, 7);
    assert.deepEqual(observed.transactions, { limit: 20, offset: 40, state: "SUCCEEDED", query: "88018" });

    const eventsResponse = await request(baseUrl, "/api/bdapps/events?limit=10&offset=20&type=caas.notification&query=9260");
    assert.equal(eventsResponse.status, 200);
    assert.equal((await eventsResponse.json()).total, 3);
    assert.deepEqual(observed.events, { limit: 10, offset: 20, eventType: "caas.notification", query: "9260" });
  });
});

test("dashboard query validation rejects invalid filters before database calls", async () => {
  let listCalls = 0;
  const harness = createHarness({
    repository: {
      async listTransactions() { listCalls += 1; return { rows: [], total: 0 }; }
    }
  });
  await withServer(harness, async (baseUrl) => {
    assert.equal((await request(baseUrl, "/api/bdapps/caas/transactions?state=complete")).status, 400);
    assert.equal((await request(baseUrl, "/api/bdapps/caas/transactions?limit=101")).status, 400);
    assert.equal(listCalls, 0);
  });
});

test("authorized SMS requests normalize the destination", async () => {
  const harness = createHarness();
  await withServer(harness, async (baseUrl) => {
    const response = await request(baseUrl, "/api/bdapps/sms/send", { mobile: MOBILE, message: "Weather alert" });
    assert.equal(response.status, 200);
    assert.deepEqual(harness.calls.at(-1).payload.destinationAddresses, ["tel:8801845082101"]);
  });
});

test("OTP requests include the mandatory application metadata", async () => {
  const harness = createHarness();
  await withServer(harness, async (baseUrl) => {
    const response = await request(baseUrl, "/api/bdapps/otp/request", { mobile: MOBILE });
    assert.equal(response.status, 200);
    const metadata = harness.calls.at(-1).payload.applicationMetaData;
    assert.deepEqual(metadata, {
      client: "WEBAPP",
      device: "Web Browser",
      os: "Web",
      appCode: "https://rookiecoders.tech/payments/"
    });
  });
});

test("OTP provider validation errors are returned as failures", async () => {
  const harness = createHarness({
    bdapps: {
      async requestOtp(payload) {
        harness.calls.push({ operation: "otp-request", payload });
        return { statusCode: "E1312", statusDetail: "Invalid request" };
      }
    }
  });
  await withServer(harness, async (baseUrl) => {
    const response = await request(baseUrl, "/api/bdapps/otp/request", { mobile: MOBILE });
    assert.equal(response.status, 422);
    assert.equal((await response.json()).bdapps.statusCode, "E1312");
  });
});

test("callbacks remain public and only record events", async () => {
  const harness = createHarness();
  await withServer(harness, async (baseUrl) => {
    const response = await request(baseUrl, "/api/bdapps/caas/notify", { externalTrxId: "spoofed", statusCode: "S1000" }, null);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { statusCode: "S1000", statusDetail: "Success" });
    assert.equal(harness.events.at(-1).type, "caas.notification");
    assert.equal(harness.transactions.size, 0);
    assert.equal(harness.calls.length, 0);
  });
});

test("confirmation gate and optional subscription gate prevent debit submission", async () => {
  const harness = createHarness({
    bdapps: {
      async getSubscriptionStatus() {
        harness.calls.push({ operation: "subscription" });
        return { subscriptionStatus: "UNREGISTERED" };
      }
    }
  });
  await withServer(harness, async (baseUrl) => {
    const unconfirmed = await request(baseUrl, "/api/bdapps/caas/direct-debit", { mobile: MOBILE, amount: "5.00" });
    assert.equal(unconfirmed.status, 400);
    assert.equal(harness.calls.length, 0);

    const unregistered = await request(baseUrl, "/api/bdapps/caas/direct-debit", { mobile: MOBILE, amount: "5.00", confirmCharge: true });
    assert.equal(unregistered.status, 409);
    assert.deepEqual(harness.calls.map((call) => call.operation), ["subscription"]);
    assert.equal(harness.transactions.size, 0);
  }, { caasSubscriptionRequired: true });
});

test("portal debit limits are enforced before provider calls", async () => {
  const harness = createHarness();
  await withServer(harness, async (baseUrl) => {
    const belowMinimum = await request(baseUrl, "/api/bdapps/caas/direct-debit", { mobile: MOBILE, amount: "4.99", confirmCharge: true });
    const aboveMaximum = await request(baseUrl, "/api/bdapps/caas/direct-debit", { mobile: MOBILE, amount: "100.01", confirmCharge: true });
    assert.equal(belowMinimum.status, 400);
    assert.equal(aboveMaximum.status, 400);
    assert.equal(harness.calls.length, 0);
  });
});

test("successful debit inserts pending first and returns a 32-character receipt ID", async () => {
  const harness = createHarness();
  await withServer(harness, async (baseUrl) => {
    const response = await request(baseUrl, "/api/bdapps/caas/direct-debit", { mobile: MOBILE, amount: "5.50", confirmCharge: true });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.match(body.externalTrxId, /^[a-f0-9]{32}$/);
    assert.equal(body.receipt.state, "SUCCEEDED");
    assert.equal(body.receipt.amount, "5.50");
    assert.deepEqual(harness.calls.map((call) => call.operation), ["insert", "debit", "complete"]);
    assert.equal(harness.calls[0].payload.externalTrxId, harness.calls[1].payload.externalTrxId);
  });
});

test("duplicate transaction ID never causes a second provider debit", async () => {
  const harness = createHarness();
  const externalTrxId = "1234567890abcdef1234567890abcdef";
  await withServer(harness, async (baseUrl) => {
    const charge = { mobile: MOBILE, amount: "5.00", confirmCharge: true, externalTrxId };
    assert.equal((await request(baseUrl, "/api/bdapps/caas/direct-debit", charge)).status, 200);
    const duplicate = await request(baseUrl, "/api/bdapps/caas/direct-debit", charge);
    assert.equal(duplicate.status, 409);
    const body = await duplicate.json();
    assert.equal(body.payment.state, "SUCCEEDED");
    assert.equal(harness.calls.filter((call) => call.operation === "debit").length, 1);
  });
});

test("provider rejection is persisted and returned as FAILED", async () => {
  const harness = createHarness({
    bdapps: {
      async directDebit(payload) {
        harness.calls.push({ operation: "debit", payload });
        return { statusCode: "E1343", statusDetail: "Not white listed" };
      }
    }
  });
  await withServer(harness, async (baseUrl) => {
    const response = await request(baseUrl, "/api/bdapps/caas/direct-debit", { mobile: MOBILE, amount: "5.00", confirmCharge: true });
    assert.equal(response.status, 422);
    const body = await response.json();
    assert.equal(body.transactionState, "FAILED");
    assert.equal(harness.transactions.get(body.externalTrxId).state, "FAILED");
  });
});

test("timeout outcome is persisted as UNKNOWN and is not retried", async () => {
  const harness = createHarness({
    bdapps: {
      async directDebit(payload) {
        harness.calls.push({ operation: "debit", payload });
        throw new BdappsError("bdapps request failed: timeout", { outcomeUnknown: true });
      }
    }
  });
  await withServer(harness, async (baseUrl) => {
    const response = await request(baseUrl, "/api/bdapps/caas/direct-debit", { mobile: MOBILE, amount: "5.00", confirmCharge: true });
    assert.equal(response.status, 502);
    const body = await response.json();
    assert.equal(body.payment.transactionState, "UNKNOWN");
    assert.equal(harness.transactions.get(body.payment.externalTrxId).state, "UNKNOWN");
    assert.equal(harness.calls.filter((call) => call.operation === "debit").length, 1);
  });
});

test("transaction lookup requires authorization and returns durable state", async () => {
  const harness = createHarness();
  const externalTrxId = "abcdef1234567890abcdef1234567890";
  harness.transactions.set(externalTrxId, { externalTrxId, state: "UNKNOWN" });
  await withServer(harness, async (baseUrl) => {
    assert.equal((await request(baseUrl, `/api/bdapps/caas/transactions/${externalTrxId}`, undefined, null)).status, 401);
    const response = await request(baseUrl, `/api/bdapps/caas/transactions/${externalTrxId}`);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).transaction.state, "UNKNOWN");
  });
});
