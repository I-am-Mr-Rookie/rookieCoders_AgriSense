import crypto from "node:crypto";

const MEMORY_ID_PATTERN = /^farm_[A-Za-z0-9_-]{24}$/;
const SUMMARY_LIMIT = 2000;
const SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const MAX_SESSIONS = 20;
const MAX_MESSAGES = 80;
const MAX_MESSAGE_LENGTH = 4000;
const MAX_TITLE_LENGTH = 72;
const MAX_SESSION_SUMMARY_LENGTH = 600;

export function createMemoryId(randomBytes = crypto.randomBytes) {
  return `farm_${randomBytes(18).toString("base64url")}`;
}

export function memoryStorageId(memoryId) {
  if (!MEMORY_ID_PATTERN.test(String(memoryId || ""))) {
    throw new Error("Invalid farmer memory ID.");
  }
  return `memory:${crypto.createHash("sha256").update(memoryId).digest("hex")}`;
}

function publicMemory(record) {
  const memory = record.lastResult?.__agrisenseMemory;
  return {
    profile: record.profile ?? {},
    lastResult: memory?.plan ?? null,
    preferences: memory?.preferences ?? {},
    conversationSummary: memory?.conversationSummary ?? "",
    sessions: normalizeSessions(memory?.sessions),
    version: memory?.version,
    updatedAt: memory?.updatedAt,
  };
}

function normalizeMessage(message = {}) {
  const role = message.role === "farmer" ? "farmer" : message.role === "agent" ? "agent" : "";
  const text = String(message.text ?? "").trim().slice(0, MAX_MESSAGE_LENGTH);
  return role && text ? { role, text } : null;
}

function normalizeSession(session = {}) {
  const id = String(session.id ?? "");
  if (!SESSION_ID_PATTERN.test(id)) throw new Error("Invalid conversation session ID.");
  const title = String(session.title || "New conversation").trim().slice(0, MAX_TITLE_LENGTH)
    || "New conversation";
  const createdAt = String(session.createdAt || "");
  const updatedAt = String(session.updatedAt || createdAt);
  const messages = (Array.isArray(session.messages) ? session.messages : [])
    .map(normalizeMessage)
    .filter(Boolean)
    .slice(-MAX_MESSAGES);
  return {
    id,
    title,
    createdAt,
    updatedAt,
    messages,
    summary: String(session.summary ?? "").slice(0, MAX_SESSION_SUMMARY_LENGTH),
    lastResult: session.lastResult ?? null,
  };
}

function normalizeSessions(sessions) {
  return (Array.isArray(sessions) ? sessions : [])
    .map(normalizeSession)
    .slice(-MAX_SESSIONS);
}

function normalizeUpdate(update = {}) {
  const summary = String(update.conversationSummary ?? "");
  if (summary.length > SUMMARY_LIMIT) throw new Error("Farmer memory summary is too long.");
  return {
    profile: update.profile ?? {},
    lastResult: update.lastResult ?? null,
    preferences: update.preferences ?? {},
    conversationSummary: summary,
    sessions: normalizeSessions(update.sessions),
  };
}

export function createMemoryService({
  loadSession,
  saveSession,
  deleteSession,
  randomBytes = crypto.randomBytes,
  now = () => new Date(),
}) {
  const mutations = new Map();

  async function serialize(memoryId, operation) {
    const previous = mutations.get(memoryId) ?? Promise.resolve();
    const current = previous.catch(() => {}).then(operation);
    mutations.set(memoryId, current);
    try {
      return await current;
    } finally {
      if (mutations.get(memoryId) === current) mutations.delete(memoryId);
    }
  }

  async function create(initial = {}) {
    const memoryId = createMemoryId(randomBytes);
    const id = memoryStorageId(memoryId);
    const normalized = normalizeUpdate(initial);
    const record = {
      id,
      profile: normalized.profile,
      lastResult: {
        __agrisenseMemory: {
          plan: normalized.lastResult,
          preferences: normalized.preferences,
          conversationSummary: normalized.conversationSummary,
          sessions: normalized.sessions,
          version: 2,
          updatedAt: now().toISOString(),
        },
      },
    };
    await saveSession(record);
    return { memoryId, memory: publicMemory(record) };
  }

  async function load(memoryId) {
    const record = await loadSession(memoryStorageId(memoryId));
    const version = record.lastResult?.__agrisenseMemory?.version;
    return version === 1 || version === 2 ? publicMemory(record) : null;
  }

  async function save(memoryId, update) {
    const id = memoryStorageId(memoryId);
    const normalized = normalizeUpdate(update);
    const record = {
      id,
      profile: normalized.profile,
      lastResult: {
        __agrisenseMemory: {
          plan: normalized.lastResult,
          preferences: normalized.preferences,
          conversationSummary: normalized.conversationSummary,
          sessions: normalized.sessions,
          version: 2,
          updatedAt: now().toISOString(),
        },
      },
    };
    await saveSession(record);
    return publicMemory(record);
  }

  async function reset(memoryId) {
    return Boolean(await deleteSession(memoryStorageId(memoryId)));
  }

  async function updatePreferences(memoryId, preferences = {}) {
    return serialize(memoryId, async () => {
      const existing = await load(memoryId);
      if (!existing) return null;
      return save(memoryId, {
        ...existing,
        preferences: {
          ...existing.preferences,
          ...(typeof preferences.autoAdjustIrrigation === "boolean"
            ? { autoAdjustIrrigation: preferences.autoAdjustIrrigation }
            : {}),
        },
        sessions: existing.sessions,
      });
    });
  }

  async function savePlan(memoryId, update, { signal } = {}) {
    return serialize(memoryId, async () => {
      signal?.throwIfAborted();
      const existing = await load(memoryId);
      if (!existing) throw new Error("Farmer memory was not found.");
      signal?.throwIfAborted();
      const updatedAt = now().toISOString();
      const sessions = update.memorySessionId
        ? existing.sessions.map((session) => session.id === update.memorySessionId
          ? {
              ...session,
              lastResult: update.lastResult,
              summary: String(update.conversationSummary ?? session.summary ?? "")
                .slice(0, MAX_SESSION_SUMMARY_LENGTH),
              updatedAt,
            }
          : session)
        : existing.sessions;
      const saved = await save(memoryId, {
        profile: update.profile,
        lastResult: update.lastResult,
        preferences: existing.preferences,
        conversationSummary: update.conversationSummary ?? existing.conversationSummary,
        sessions,
      });
      if (signal?.aborted) {
        await save(memoryId, existing);
        signal.throwIfAborted();
      }
      return saved;
    });
  }

  async function createConversationSession(memoryId, session = {}) {
    return serialize(memoryId, async () => {
      const existing = await load(memoryId);
      if (!existing) throw new Error("Farmer memory was not found.");
      if (existing.sessions.some((item) => item.id === String(session.id || ""))) {
        return existing;
      }
      const timestamp = now().toISOString();
      const normalized = normalizeSession({
        ...session,
        createdAt: session.createdAt || timestamp,
        updatedAt: timestamp,
      });
      const sessions = [
        ...existing.sessions.filter((item) => item.id !== normalized.id),
        normalized,
      ].slice(-MAX_SESSIONS);
      return save(memoryId, { ...existing, sessions });
    });
  }

  async function appendConversationTurn(memoryId, update = {}) {
    return serialize(memoryId, async () => {
      const existing = await load(memoryId);
      if (!existing) throw new Error("Farmer memory was not found.");
      const sessionId = String(update.sessionId || "");
      if (!SESSION_ID_PATTERN.test(sessionId)) throw new Error("Invalid conversation session ID.");
      const additions = (Array.isArray(update.messages) ? update.messages : [])
        .map(normalizeMessage)
        .filter(Boolean);
      const timestamp = now().toISOString();
      let found = false;
      const sessions = existing.sessions.map((session) => {
        if (session.id !== sessionId) return session;
        found = true;
        const firstFarmerMessage = additions.find((message) => message.role === "farmer")?.text;
        const title = session.title === "New conversation" && firstFarmerMessage
          ? firstFarmerMessage.slice(0, MAX_TITLE_LENGTH)
          : session.title;
        return {
          ...session,
          title,
          updatedAt: timestamp,
          messages: [...session.messages, ...additions].slice(-MAX_MESSAGES),
          summary: String(update.conversationSummary ?? session.summary ?? "")
            .slice(0, MAX_SESSION_SUMMARY_LENGTH),
        };
      });
      if (!found) throw new Error("Conversation session was not found.");
      return save(memoryId, {
        ...existing,
        conversationSummary: update.conversationSummary ?? existing.conversationSummary,
        sessions,
      });
    });
  }

  return {
    create,
    load,
    save,
    savePlan,
    reset,
    updatePreferences,
    createConversationSession,
    appendConversationTurn,
  };
}
