const FALLBACK = "AgriSense returned an unreadable response.";

export function assistantText(value) {
  if (typeof value === "string" && value.trim()) return value;
  if (value && typeof value === "object" && typeof value.text === "string" && value.text.trim()) return value.text;
  return FALLBACK;
}
