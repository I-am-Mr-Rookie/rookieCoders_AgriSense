import test from "node:test";
import assert from "node:assert/strict";

import {
  createMemoryId,
  createMemoryService,
  memoryStorageId,
} from "../server/memory.js";

test("creates a high-entropy farmer recovery ID with an explicit prefix", () => {
  const id = createMemoryId(() => Buffer.alloc(18, 7));

  assert.match(id, /^farm_[A-Za-z0-9_-]{24}$/);
});

test("derives a stable storage ID without retaining the bearer recovery ID", () => {
  const memoryId = "farm_0123456789abcdefghijklmn";
  const first = memoryStorageId(memoryId);
  const second = memoryStorageId(memoryId);

  assert.equal(first, second);
  assert.match(first, /^memory:[a-f0-9]{64}$/);
  assert.doesNotMatch(first, /0123456789abcdefghijklmn/);
  assert.throws(() => memoryStorageId("not-a-memory-id"), /Invalid farmer memory ID/);
});

test("creates, resumes, updates, and resets farmer memory without storing the bearer ID", async () => {
  const records = new Map();
  const savedRecords = [];
  const service = createMemoryService({
    randomBytes: () => Buffer.alloc(18, 5),
    loadSession: async (id) => records.get(id) ?? { id, profile: {}, lastResult: null },
    saveSession: async (record) => {
      savedRecords.push(structuredClone(record));
      records.set(record.id, structuredClone(record));
    },
    deleteSession: async (id) => records.delete(id),
    now: () => new Date("2026-07-25T01:00:00+06:00"),
  });

  const created = await service.create();
  assert.match(created.memoryId, /^farm_/);
  assert.deepEqual(created.memory, {
    profile: {},
    lastResult: null,
    preferences: {},
    conversationSummary: "",
    sessions: [],
    version: 2,
    updatedAt: "2026-07-24T19:00:00.000Z",
  });

  const updated = await service.save(created.memoryId, {
    profile: { location: "Gazipur", budgetBdt: 90000 },
    lastResult: { crops: [{ id: "maize" }] },
    preferences: { autoAdjustIrrigation: true },
    conversationSummary: "Farmer prefers low-risk options.",
  });
  assert.equal(updated.profile.location, "Gazipur");
  assert.equal(updated.preferences.autoAdjustIrrigation, true);

  const resumed = await service.load(created.memoryId);
  assert.deepEqual(resumed, updated);
  assert.equal(JSON.stringify(savedRecords).includes(created.memoryId), false);
  assert.deepEqual(Object.keys(savedRecords.at(-1)).sort(), ["id", "lastResult", "profile"]);
  assert.equal(savedRecords.at(-1).lastResult.__agrisenseMemory.version, 2);

  assert.equal(await service.reset(created.memoryId), true);
  assert.equal(await service.load(created.memoryId), null);
});

test("rejects oversized summaries and strips unknown memory fields", async () => {
  const records = new Map();
  const service = createMemoryService({
    randomBytes: () => Buffer.alloc(18, 3),
    loadSession: async (id) => records.get(id) ?? { id, profile: {}, lastResult: null },
    saveSession: async (record) => records.set(record.id, structuredClone(record)),
    deleteSession: async (id) => records.delete(id),
  });
  const { memoryId } = await service.create();

  await assert.rejects(
    service.save(memoryId, { conversationSummary: "x".repeat(2001) }),
    /summary is too long/,
  );

  const saved = await service.save(memoryId, {
    profile: { location: "Gazipur" },
    unexpected: "discard me",
  });
  assert.equal("unexpected" in saved, false);
});

test("creates memory from an existing verified session snapshot", async () => {
  const records = new Map();
  const service = createMemoryService({
    randomBytes: () => Buffer.alloc(18, 9),
    loadSession: async (id) => records.get(id) ?? { id, profile: {}, lastResult: null },
    saveSession: async (record) => records.set(record.id, structuredClone(record)),
    deleteSession: async (id) => records.delete(id),
  });

  const created = await service.create({
    profile: { location: "Gazipur", budgetBdt: 90000 },
    lastResult: { crops: [{ id: "maize" }] },
    preferences: { autoAdjustIrrigation: false },
  });

  assert.equal(created.memory.profile.location, "Gazipur");
  assert.equal(created.memory.lastResult.crops[0].id, "maize");
  assert.equal(created.memory.preferences.autoAdjustIrrigation, false);
});

test("updates memory preferences immediately without replacing the saved plan", async () => {
  const records = new Map();
  const service = createMemoryService({
    randomBytes: () => Buffer.alloc(18, 4),
    loadSession: async (id) => records.get(id) ?? { id, profile: {}, lastResult: null },
    saveSession: async (record) => records.set(record.id, structuredClone(record)),
    deleteSession: async (id) => records.delete(id),
  });
  const created = await service.create({
    profile: { location: "Gazipur" },
    lastResult: { crops: [{ id: "maize" }] },
    preferences: { autoAdjustIrrigation: true },
  });

  const updated = await service.updatePreferences(created.memoryId, {
    autoAdjustIrrigation: false,
  });

  assert.equal(updated.preferences.autoAdjustIrrigation, false);
  assert.equal(updated.lastResult.crops[0].id, "maize");
});

test("serializes plan and preference writes so neither update is lost", async () => {
  const records = new Map();
  const service = createMemoryService({
    randomBytes: () => Buffer.alloc(18, 2),
    loadSession: async (id) => records.get(id) ?? { id, profile: {}, lastResult: null },
    saveSession: async (record) => records.set(record.id, structuredClone(record)),
    deleteSession: async (id) => records.delete(id),
  });
  const created = await service.create({
    profile: { location: "Gazipur" },
    lastResult: { crops: [{ id: "mustard" }] },
    preferences: { autoAdjustIrrigation: true },
  });

  await Promise.all([
    service.savePlan(created.memoryId, {
      profile: { location: "Gazipur" },
      lastResult: { crops: [{ id: "maize" }] },
    }),
    service.updatePreferences(created.memoryId, { autoAdjustIrrigation: false }),
  ]);
  const final = await service.load(created.memoryId);

  assert.equal(final.lastResult.crops[0].id, "maize");
  assert.equal(final.preferences.autoAdjustIrrigation, false);
});
