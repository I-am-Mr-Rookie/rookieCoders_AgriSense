const INITIAL_GREETING =
  "Tell me about your farm. I will ask only for missing details.";

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

export function createFreshDemoState(createId = createSessionId) {
  return {
    sessionId: createId(),
    message: "",
    conversation: createInitialConversation(),
    result: null,
    error: "",
  };
}
