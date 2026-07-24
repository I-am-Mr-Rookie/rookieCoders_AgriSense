export function createAgentRun({ id, mode = "live", startedAt }) {
  if (mode !== "live" && mode !== "demo") {
    throw new TypeError('Agent run mode must be "live" or "demo".');
  }

  return {
    id,
    status: "running",
    mode,
    events: [],
    reasoningSummaries: [],
    startedAt,
    completedAt: null,
    collapsed: false,
    answer: "",
  };
}

function isTerminalAgentRun(run) {
  return run.status === "complete"
    || run.status === "failed"
    || run.status === "cancelled";
}

export function appendRunEvent(run, event) {
  if (isTerminalAgentRun(run)) return run;

  const hasDuplicateId = event?.id != null
    && run.events.some((recorded) => recorded.id === event.id);
  if (hasDuplicateId) return run;

  return {
    ...run,
    events: [...run.events, event],
  };
}

export function completeAgentRun(
  run,
  { answer, reasoningSummaries, completedAt },
) {
  if (isTerminalAgentRun(run)) return run;

  const { error: _error, ...withoutError } = run;
  return {
    ...withoutError,
    status: "complete",
    events: [...run.events],
    reasoningSummaries: [...reasoningSummaries],
    completedAt,
    answer,
  };
}

export function failAgentRun(run, { error, completedAt }) {
  if (isTerminalAgentRun(run)) return run;

  return {
    ...run,
    status: "failed",
    events: [...run.events],
    completedAt,
    collapsed: false,
    error,
  };
}

export function cancelAgentRun(run, { completedAt }) {
  if (isTerminalAgentRun(run)) return run;

  const { error: _error, ...withoutError } = run;
  return {
    ...withoutError,
    status: "cancelled",
    events: [...run.events],
    completedAt,
    collapsed: false,
  };
}

export function toggleRunCollapsed(run) {
  return {
    ...run,
    collapsed: !run.collapsed,
  };
}

function timestampMilliseconds(timestamp) {
  if (timestamp instanceof Date) return timestamp.getTime();
  if (typeof timestamp === "number") return timestamp;
  if (typeof timestamp === "string" && timestamp.trim()) {
    return Date.parse(timestamp);
  }
  return Number.NaN;
}

export function getRunElapsedMs(run, now) {
  const startedAt = timestampMilliseconds(run.startedAt);
  const completedAt = timestampMilliseconds(run.completedAt ?? now);
  if (!Number.isFinite(startedAt) || !Number.isFinite(completedAt)) return null;
  return Math.max(0, completedAt - startedAt);
}
