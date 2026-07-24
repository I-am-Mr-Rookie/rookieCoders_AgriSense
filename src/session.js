const INITIAL_GREETING =
  "Tell me about your farm. I will ask only for missing details.";
const SESSION_STORAGE_KEY = "agrisense.sessionId";

export function createInitialConversation() {
  return [{ role: "agent", text: INITIAL_GREETING }];
}

export function createSessionId(
  cryptoLike = globalThis.crypto,
  now = Date.now,
  random = Math.random,
) {
  if (typeof cryptoLike?.randomUUID === "function") {
    try {
      const sessionId = cryptoLike.randomUUID();
      if (typeof sessionId === "string" && sessionId) return sessionId;
    } catch {
      // Fall back to a browser-safe correlation ID.
    }
  }

  const timestamp = Number(now()).toString(36);
  const entropy = Math.floor(Number(random()) * 0x100000000)
    .toString(36)
    .padStart(7, "0");
  return `agrisense-${timestamp}-${entropy}`;
}

export function persistSessionId(sessionId, storage = globalThis.localStorage) {
  try {
    storage?.setItem?.(SESSION_STORAGE_KEY, sessionId);
  } catch {
    // Private browsing or a locked-down browser can deny storage.
  }
  return sessionId;
}

export function loadOrCreateSessionId(
  storage = globalThis.localStorage,
  createId = createSessionId,
) {
  try {
    const stored = storage?.getItem?.(SESSION_STORAGE_KEY);
    if (typeof stored === "string" && stored.trim()) return stored;
  } catch {
    // Fall through to a fresh, usable in-memory ID.
  }
  return persistSessionId(createId(), storage);
}

export function createFreshDemoState(createId = createSessionId) {
  return {
    sessionId: createId(),
    message: "",
    conversation: createInitialConversation(),
    result: null,
    error: "",
  };
}
