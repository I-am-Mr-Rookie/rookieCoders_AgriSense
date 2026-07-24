const SECRET_KEY = /api.?key|password|secret|token|authorization|memory.?id|recovery.?id/i;

export function sanitizeActivityValue(value, key = "") {
  if (SECRET_KEY.test(key)) return "[REDACTED]";
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => sanitizeActivityValue(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).slice(0, 30).map(([name, item]) => [name, sanitizeActivityValue(item, name)]),
    );
  }
  if (typeof value === "string") {
    if (/(?:sk-[A-Za-z0-9_-]{8,}|Bearer\s+\S+|farm_[A-Za-z0-9_-]{24})/i.test(value)) {
      return "[REDACTED]";
    }
    return value.slice(0, 1000);
  }
  return value;
}

export function createActivityEmitter(onEvent = () => {}, now = () => new Date()) {
  let sequence = 0;
  return async function emit(type, label, status, details = {}, durationMs) {
    const event = {
      id: `activity-${++sequence}`,
      type,
      label,
      status,
      timestamp: now().toISOString(),
      details: sanitizeActivityValue(details),
    };
    if (Number.isFinite(durationMs)) event.durationMs = durationMs;
    await onEvent(event);
    return event;
  };
}

export function createNdjsonWriter(res) {
  res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();
  return (event) => res.write(`${JSON.stringify(event)}\n`);
}
