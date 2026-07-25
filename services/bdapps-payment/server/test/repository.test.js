import assert from "node:assert/strict";
import { test } from "node:test";
import { PostgresRepository } from "../src/repository.js";

function repositoryWithResponses(responses) {
  const repository = Object.create(PostgresRepository.prototype);
  const calls = [];
  repository.pool = {
    async query(sql, values = []) {
      calls.push({ sql, values });
      return responses[calls.length - 1];
    }
  };
  return { repository, calls };
}

test("transaction history uses parameterized filters and returns a separate total", async () => {
  const { repository, calls } = repositoryWithResponses([
    { rows: [{ externalTrxId: "tx-1" }] },
    { rows: [{ total: 12 }] }
  ]);
  const result = await repository.listTransactions({ limit: 25, offset: 50, state: "FAILED", query: "88018" });
  assert.deepEqual(result, { rows: [{ externalTrxId: "tx-1" }], total: 12 });
  assert.match(calls[0].sql, /state = \$1/);
  assert.match(calls[0].sql, /external_trx_id ilike \$2/);
  assert.deepEqual(calls[0].values, ["FAILED", "%88018%", 25, 50]);
  assert.deepEqual(calls[1].values, ["FAILED", "%88018%"]);
});

test("event history uses parameterized type and payload search", async () => {
  const { repository, calls } = repositoryWithResponses([
    { rows: [{ id: 1 }] },
    { rows: [{ total: 4 }] }
  ]);
  const result = await repository.listEvents({ limit: 10, offset: 0, eventType: "caas.notification", query: "external" });
  assert.equal(result.total, 4);
  assert.match(calls[0].sql, /event_type = \$1/);
  assert.match(calls[0].sql, /payload::text ilike \$2/);
  assert.deepEqual(calls[0].values, ["caas.notification", "%external%", 10, 0]);
});
