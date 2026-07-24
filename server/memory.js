import crypto from "node:crypto";

const MEMORY_ID_PATTERN = /^farm_[A-Za-z0-9_-]{24}$/;
const SUMMARY_LIMIT = 2000;

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
    version: memory?.version,
    updatedAt: memory?.updatedAt,
  };
}

function normalizeUpdate(update = {}) {
  const summary = String(update.conversationSummary ?? "");
  if (summary.length > SUMMARY_LIMIT) throw new Error("Farmer memory summary is too long.");
  return {
    profile: update.profile ?? {},
    lastResult: update.lastResult ?? null,
    preferences: update.preferences ?? {},
    conversationSummary: summary,
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
          version: 1,
          updatedAt: now().toISOString(),
        },
      },
    };
    await saveSession(record);
    return { memoryId, memory: publicMemory(record) };
  }

  async function load(memoryId) {
    const record = await loadSession(memoryStorageId(memoryId));
    return record.lastResult?.__agrisenseMemory?.version === 1 ? publicMemory(record) : null;
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
          version: 1,
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
      });
    });
  }

  async function savePlan(memoryId, update, { signal } = {}) {
    return serialize(memoryId, async () => {
      signal?.throwIfAborted();
      const existing = await load(memoryId);
      if (!existing) throw new Error("Farmer memory was not found.");
      signal?.throwIfAborted();
      const saved = await save(memoryId, {
        profile: update.profile,
        lastResult: update.lastResult,
        preferences: existing.preferences,
        conversationSummary: update.conversationSummary ?? existing.conversationSummary,
      });
      if (signal?.aborted) {
        await save(memoryId, existing);
        signal.throwIfAborted();
      }
      return saved;
    });
  }

  return { create, load, save, savePlan, reset, updatePreferences };
}
