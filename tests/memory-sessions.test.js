import test from "node:test";
import assert from "node:assert/strict";

import { createMemoryService, memoryStorageId } from "../server/memory.js";

function harness() {
  const records = new Map();
  let tick = 0;
  const service = createMemoryService({
    randomBytes: () => Buffer.alloc(18, 6),
    loadSession: async (id) => records.get(id) ?? { id, profile: {}, lastResult: null },
    saveSession: async (record) => records.set(record.id, structuredClone(record)),
    deleteSession: async (id) => records.delete(id),
    now: () => new Date(Date.UTC(2026, 6, 25, 0, 0, tick++)),
  });
  return { records, service };
}

test("one recovery code owns shared farm memory and separate chat sessions", async () => {
  const { service } = harness();
  const created = await service.create({
    profile: { location: "Gazipur", budgetBdt: 90000 },
    preferences: { autoAdjustIrrigation: true },
  });

  await service.createConversationSession(created.memoryId, {
    id: "chat-budget",
    title: "Budget update",
  });
  await service.appendConversationTurn(created.memoryId, {
    sessionId: "chat-budget",
    messages: [
      { role: "farmer", text: "Change my budget." },
      { role: "agent", text: "What should your new budget be?" },
    ],
  });
  await service.savePlan(created.memoryId, {
    memorySessionId: "chat-budget",
    profile: { location: "Gazipur", budgetBdt: 40000 },
    lastResult: { crops: [{ id: "maize", suitability: 62 }] },
  });

  await service.createConversationSession(created.memoryId, {
    id: "chat-irrigation",
    title: "Irrigation question",
  });
  await service.appendConversationTurn(created.memoryId, {
    sessionId: "chat-irrigation",
    messages: [
      { role: "farmer", text: "Will rain delay irrigation?" },
      { role: "agent", text: "Let us compare the forecast." },
    ],
  });

  const memory = await service.load(created.memoryId);
  const budgetChat = memory.sessions.find((session) => session.id === "chat-budget");
  const irrigationChat = memory.sessions.find((session) => session.id === "chat-irrigation");

  assert.equal(memory.version, 2);
  assert.equal(memory.profile.budgetBdt, 40000);
  assert.equal(memory.preferences.autoAdjustIrrigation, true);
  assert.equal(memory.lastResult.crops[0].suitability, 62);
  assert.deepEqual(budgetChat.messages.map((message) => message.role), ["farmer", "agent"]);
  assert.equal(budgetChat.lastResult.crops[0].id, "maize");
  assert.equal(irrigationChat.lastResult, null);
  assert.equal(irrigationChat.messages[0].text, "Will rain delay irrigation?");
});

test("conversation storage is bounded and sanitizes untrusted shapes", async () => {
  const { service } = harness();
  const { memoryId } = await service.create();

  for (let index = 0; index < 22; index += 1) {
    await service.createConversationSession(memoryId, {
      id: `chat-${index}`,
      title: `Conversation ${index}`,
    });
  }
  await service.appendConversationTurn(memoryId, {
    sessionId: "chat-21",
    messages: Array.from({ length: 90 }, (_, index) => ({
      role: index % 2 ? "agent" : "farmer",
      text: `${index}-${"x".repeat(5000)}`,
      secret: "discard",
    })),
  });

  const memory = await service.load(memoryId);
  const latest = memory.sessions.find((session) => session.id === "chat-21");

  assert.equal(memory.sessions.length, 20);
  assert.equal(memory.sessions.some((session) => session.id === "chat-0"), false);
  assert.equal(latest.messages.length, 80);
  assert.equal(latest.messages.every((message) => message.text.length <= 4000), true);
  assert.equal(latest.messages.every((message) => Object.keys(message).sort().join(",") === "role,text"), true);
});

test("legacy version-one memory loads with an empty session list", async () => {
  const { records, service } = harness();
  const memoryId = "farm_0123456789abcdefghijklmn";
  records.set(memoryStorageId(memoryId), {
    id: memoryStorageId(memoryId),
    profile: { location: "Gazipur" },
    lastResult: {
      __agrisenseMemory: {
        plan: { crops: [{ id: "mustard" }] },
        preferences: {},
        conversationSummary: "Legacy memory.",
        version: 1,
        updatedAt: "2026-07-24T19:00:00.000Z",
      },
    },
  });

  const memory = await service.load(memoryId);

  assert.equal(memory.version, 1);
  assert.deepEqual(memory.sessions, []);
  assert.equal(memory.lastResult.crops[0].id, "mustard");
});
