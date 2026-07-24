import test from "node:test";
import assert from "node:assert/strict";

test("initial persistence failure does not claim new farm details are safe", async () => {
  const { createPersistenceGuard } = await import("../server/recovery.js");
  const guard = createPersistenceGuard(async () => {
    throw new Error("database unavailable");
  });

  await assert.rejects(guard.saveMergedProfile({ id: "session-1" }), /database unavailable/);
  assert.deepEqual(guard.failurePayload("opaque-save-id"), {
    error: "AgriSense could not save this step. Please retry; do not assume your new farm details were stored.",
    errorId: "opaque-save-id",
    phase: "Tier-0",
    recoverable: true,
  });
});

test("downstream failure retains saved-details-safe wording after persistence", async () => {
  const { createPersistenceGuard } = await import("../server/recovery.js");
  const saved = [];
  const guard = createPersistenceGuard(async (session) => {
    saved.push(session.id);
  });

  await guard.saveMergedProfile({ id: "session-2" });

  assert.deepEqual(saved, ["session-2"]);
  assert.deepEqual(guard.failurePayload("opaque-downstream-id"), {
    error: "AgriSense could not complete this step. Your saved farm details are safe; please retry.",
    errorId: "opaque-downstream-id",
    phase: "Tier-0",
    recoverable: true,
  });
});

test("summarizes internal errors with bounded public-safe fields only", async () => {
  const { summarizeError } = await import("../server/recovery.js");
  const error = Object.assign(new Error(`secret:${"m".repeat(600)}`), {
    name: "ProviderFailure".repeat(10),
    code: "PROVIDER_INTERNAL".repeat(10),
    status: 503,
    credentials: "must-not-be-logged",
  });

  const summary = summarizeError(error);

  assert.deepEqual(Object.keys(summary), ["name", "message", "code", "status"]);
  assert.ok(summary.name.length <= 80);
  assert.ok(summary.message.length <= 500);
  assert.ok(summary.code.length <= 80);
  assert.equal(summary.status, 503);
  assert.equal(JSON.stringify(summary).includes("must-not-be-logged"), false);
  assert.equal("stack" in summary, false);
});
