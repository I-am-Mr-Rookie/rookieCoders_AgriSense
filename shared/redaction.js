const RECOVERY_ID = /(^|[^A-Za-z0-9_-])farm_[A-Za-z0-9_-]{24}(?![A-Za-z0-9_-])/g;

export function redactRecoveryIds(value, replacement = "[REDACTED_RECOVERY_ID]") {
  return String(value || "").replace(
    RECOVERY_ID,
    (_match, prefix) => `${prefix}${replacement}`,
  );
}
