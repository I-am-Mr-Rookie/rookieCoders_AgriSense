import { publicFailure } from "./validation.js";

export function persistenceFailure(errorId) {
  return {
    error: "AgriSense could not save this step. Please retry; do not assume your new farm details were stored.",
    errorId,
    phase: "Tier-0",
    recoverable: true,
  };
}

export function createPersistenceGuard(saveSession) {
  let mergedProfileSaved = false;
  return {
    async saveMergedProfile(session) {
      await saveSession(session);
      mergedProfileSaved = true;
    },
    failurePayload(errorId) {
      return mergedProfileSaved ? publicFailure(errorId) : persistenceFailure(errorId);
    },
  };
}

function boundedText(value, maximum, fallback) {
  const text = typeof value === "string"
    ? value
    : typeof value === "number" && Number.isFinite(value)
      ? String(value)
      : fallback;
  return text.slice(0, maximum);
}

export function summarizeError(error) {
  const source = error !== null && typeof error === "object" ? error : {};
  const status = Number(source.status);
  return {
    name: boundedText(source.name, 80, "Error"),
    message: boundedText(source.message, 500, "Unexpected internal error"),
    code: boundedText(source.code, 80, ""),
    status: Number.isInteger(status) && status >= 100 && status <= 599 ? status : undefined,
  };
}
