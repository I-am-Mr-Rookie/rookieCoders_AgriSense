import test from "node:test";
import assert from "node:assert/strict";

import {
  createFreshDemoState,
  createInitialConversation,
  createSessionId,
  loadOrCreateSessionId,
  persistSessionId,
} from "../src/session.js";

test("uses crypto.randomUUID when the browser provides it", () => {
  const sessionId = createSessionId(
    { randomUUID: () => "native-session-id" },
    () => 123,
    () => 0.5,
  );

  assert.equal(sessionId, "native-session-id");
});

test("creates a non-empty fallback when crypto.randomUUID is unavailable", () => {
  const sessionId = createSessionId(null, () => 12345, () => 0.5);

  assert.match(sessionId, /^agrisense-[a-z0-9]+-[a-z0-9]+$/);
});

test("reuses the stored session ID after a browser reload", () => {
  const values = new Map([["agrisense.sessionId", "saved-session"]]);
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };

  const sessionId = loadOrCreateSessionId(storage, () => "new-session");

  assert.equal(sessionId, "saved-session");
});

test("stores new and explicitly replaced session IDs", () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };

  assert.equal(loadOrCreateSessionId(storage, () => "created-session"), "created-session");
  assert.equal(values.get("agrisense.sessionId"), "created-session");
  assert.equal(persistSessionId("demo-session", storage), "demo-session");
  assert.equal(values.get("agrisense.sessionId"), "demo-session");
});

test("storage failures fall back to a usable in-memory session ID", () => {
  const storage = {
    getItem: () => {
      throw new Error("storage blocked");
    },
    setItem: () => {
      throw new Error("storage blocked");
    },
  };

  assert.equal(loadOrCreateSessionId(storage, () => "fallback-session"), "fallback-session");
});

test("a fresh demo gets a new session and only resets demo-owned state", () => {
  let sequence = 0;
  const createId = () => `session-${++sequence}`;

  const first = createFreshDemoState(createId);
  const second = createFreshDemoState(createId);

  assert.equal(first.sessionId, "session-1");
  assert.equal(second.sessionId, "session-2");
  assert.notEqual(first.conversation, second.conversation);
  assert.deepEqual(first.conversation, [
    {
      role: "agent",
      text: "How can I help you?",
    },
  ]);
  assert.deepEqual(
    Object.keys(first).sort(),
    ["conversation", "error", "message", "result", "sessionId"],
  );
  assert.equal(first.message, "");
  assert.equal(first.result, null);
  assert.equal(first.error, "");
});

test("initial conversations do not share mutable collections", () => {
  const first = createInitialConversation();
  const second = createInitialConversation();

  assert.deepEqual(first, second);
  assert.notEqual(first, second);
});
