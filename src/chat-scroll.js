export function isNearTranscriptBottom(element, threshold = 80) {
  if (!element) return true;
  return element.scrollHeight - element.scrollTop - element.clientHeight < threshold;
}

export function pinTranscript(element) {
  element?.scrollTo?.({ top: element.scrollHeight, behavior: "auto" });
}

export function focusTranscriptItem(element, item, offset = 8) {
  if (!element?.scrollTo || !item?.getBoundingClientRect) return;
  const transcriptTop = element.getBoundingClientRect().top;
  const itemTop = item.getBoundingClientRect().top;
  element.scrollTo({
    top: Math.max(0, element.scrollTop + itemTop - transcriptTop - offset),
    behavior: "auto",
  });
}
