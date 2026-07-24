export async function consumeNdjsonStream(response, onActivity) {
  if (!response.ok || !response.body) {
    throw new Error("AgriSense could not start the activity stream.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result;

  function consumeLine(line) {
    if (!line.trim()) return;
    const event = JSON.parse(line);
    if (event.type === "result") {
      result = event.data;
      return;
    }
    onActivity(event);
    if (event.type === "request.failed") {
      throw new Error(event.details?.error || "AgriSense could not complete this request.");
    }
  }

  for (;;) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) consumeLine(line);
    if (done) break;
  }
  if (buffer.trim()) consumeLine(buffer);
  if (!result) throw new Error("AgriSense activity stream ended before a final result.");
  return result;
}
