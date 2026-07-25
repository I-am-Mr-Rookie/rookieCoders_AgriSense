import assert from "node:assert/strict";
import test from "node:test";

import { createDailyAccessService, dhakaAccessDate } from "../server/daily-access.js";

test("uses the Asia/Dhaka calendar date at the UTC boundary", () => {
  assert.equal(dhakaAccessDate(new Date("2026-07-24T18:01:00.000Z")), "2026-07-25");
});

test("same-day repeated and concurrent access produces one deterministic debit", async () => {
  const records = new Map();
  const charges = [];
  const store = {
    async loadDailyAccess(userId, date) { return records.get(`${userId}:${date}`) ?? null; },
    async claimDailyAccess(record) {
      const key = `${record.userId}:${record.accessDate}`;
      if (records.has(key)) return false;
      records.set(key, { ...record, state: "PENDING" });
      return true;
    },
    async completeDailyAccess(userId, date, update) {
      const key = `${userId}:${date}`;
      records.set(key, { ...records.get(key), ...update });
      return records.get(key);
    },
  };
  const gateway = {
    async chargeDaily(payload) {
      charges.push(payload);
      await new Promise((resolve) => setTimeout(resolve, 5));
      return { transactionState: "SUCCEEDED", statusCode: "S1000" };
    },
  };
  const service = createDailyAccessService({
    store,
    gateway,
    enabled: true,
    now: () => new Date("2026-07-25T01:00:00.000Z"),
  });

  const results = await Promise.all(Array.from({ length: 25 }, () => (
    service.ensureAccess({ userId: "farmer-1", mobile: "8801845082101" })
  )));
  const third = await service.ensureAccess({ userId: "farmer-1", mobile: "8801845082101" });

  assert.equal(charges.length, 1);
  assert.equal(new Set(charges.map((item) => item.externalTrxId)).size, 1);
  assert.equal(results.some((item) => item.state === "PAID"), true);
  assert.equal(third.state, "PAID");
  assert.equal(third.charged, false);
});

test("failed debit never grants a paid entitlement", async () => {
  const records = new Map();
  const store = {
    async loadDailyAccess(userId, date) { return records.get(`${userId}:${date}`) ?? null; },
    async claimDailyAccess(record) { records.set(`${record.userId}:${record.accessDate}`, { ...record, state: "PENDING" }); return true; },
    async completeDailyAccess(userId, date, update) { records.set(`${userId}:${date}`, update); return update; },
  };
  const service = createDailyAccessService({
    store,
    gateway: { async chargeDaily() { throw new Error("provider rejected"); } },
    enabled: true,
    now: () => new Date("2026-07-25T01:00:00.000Z"),
  });

  await assert.rejects(
    service.ensureAccess({ userId: "farmer-2", mobile: "8801845082101" }),
    /Daily access payment could not be confirmed/,
  );
  assert.equal(records.get("farmer-2:2026-07-25").state, "FAILED");
});

test("a later login can retry one failed charge without opening a concurrency duplicate", async () => {
  const records = new Map();
  const charges = [];
  const store = {
    async loadDailyAccess(userId, date) { return records.get(`${userId}:${date}`) ?? null; },
    async claimDailyAccess(record) {
      const key = `${record.userId}:${record.accessDate}`;
      const existing = records.get(key);
      if (existing && existing.state !== "FAILED") return false;
      records.set(key, {
        ...record,
        state: "PENDING",
        attemptCount: (existing?.attemptCount || 0) + 1,
      });
      return true;
    },
    async completeDailyAccess(userId, date, update) {
      const key = `${userId}:${date}`;
      records.set(key, { ...records.get(key), ...update });
      return records.get(key);
    },
  };
  const service = createDailyAccessService({
    store,
    gateway: {
      async chargeDaily(payload) {
        charges.push(payload);
        if (charges.length === 1) throw new Error("provider rejected");
        await new Promise((resolve) => setTimeout(resolve, 5));
        return { transactionState: "SUCCEEDED", statusCode: "S1000" };
      },
    },
    enabled: true,
    now: () => new Date("2026-07-25T01:00:00.000Z"),
  });

  await assert.rejects(
    service.ensureAccess({ userId: "farmer-retry", mobile: "8801845082101" }),
    /could not be confirmed/,
  );
  const results = await Promise.all(Array.from({ length: 10 }, () => (
    service.ensureAccess({ userId: "farmer-retry", mobile: "8801845082101" })
  )));

  assert.equal(charges.length, 2);
  assert.equal(new Set(charges.map((entry) => entry.externalTrxId)).size, 2);
  assert.equal(results.every((entry) => entry.state === "PAID"), true);
  assert.equal(records.get("farmer-retry:2026-07-25").attemptCount, 2);
});

test("disabled live billing reports a safe preview without calling the gateway", async () => {
  let calls = 0;
  const service = createDailyAccessService({
    store: { async loadDailyAccess() { return null; } },
    gateway: { async chargeDaily() { calls += 1; } },
    enabled: false,
    now: () => new Date("2026-07-25T01:00:00.000Z"),
  });
  const result = await service.ensureAccess({ userId: "farmer-3", mobile: "8801845082101" });
  assert.deepEqual(result, {
    state: "BILLING_DISABLED",
    accessDate: "2026-07-25",
    amountBdt: "5.00",
    charged: false,
  });
  assert.equal(calls, 0);
});
