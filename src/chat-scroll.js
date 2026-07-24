export function isNearTranscriptBottom(element, threshold = 80) {
  if (!element) return true;
  return element.scrollHeight - element.scrollTop - element.clientHeight < threshold;
}

export function pinTranscript(element) {
  element?.scrollTo?.({ top: element.scrollHeight, behavior: "auto" });
}
