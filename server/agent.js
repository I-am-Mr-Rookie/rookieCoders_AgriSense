const SECRET_KEY = /api.?key|password|secret|token|authorization|database.?url/i;

function redact(value, key = "") {
  if (SECRET_KEY.test(key)) return "[REDACTED]";
  if (Array.isArray(value)) return value.map((item) => redact(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([name, item]) => [name, redact(item, name)]));
  }
  if (typeof value === "string" && /(?:sk-[A-Za-z0-9_-]{8,}|Bearer\s+\S+)/i.test(value)) return "[REDACTED]";
  return value;
}

export async function runToolLoop({
  client,
  model = "gpt-5.6-sol",
  input,
  toolDefinitions = [],
  handlers = {},
  maxCalls = 8,
  reasoning = { effort: "medium", summary: "auto" },
  signal,
}) {
  const history = typeof input === "string" ? [{ role: "user", content: input }] : [...input];
  const trace = [];
  const reasoningSummaries = [];
  const signatures = new Set();

  for (;;) {
    signal?.throwIfAborted();
    const response = await client.responses.create({
      model,
      reasoning: { ...reasoning, summary: reasoning.summary ?? "auto" },
      input: history,
      tools: toolDefinitions,
      parallel_tool_calls: true,
      store: false,
    }, { signal });
    signal?.throwIfAborted();
    for (const item of response.output ?? []) {
      if (item.type !== "reasoning") continue;
      for (const summary of item.summary ?? []) {
        if (summary.type === "summary_text" && typeof summary.text === "string" && summary.text.trim()) {
          reasoningSummaries.push(summary.text.trim().slice(0, 1200));
        }
      }
    }
    const calls = (response.output ?? []).filter((item) => item.type === "function_call");
    if (!calls.length) {
      return {
        text: response.output_text ?? "",
        trace,
        reasoningSummaries,
        usage: response.usage ?? null,
        responseId: response.id,
      };
    }
    history.push(...(response.output ?? []));
    for (const call of calls) {
      if (!Object.hasOwn(handlers, call.name)) throw new Error(`Tool ${call.name} is not allowed`);
      if (trace.length >= maxCalls) throw new Error(`Tool-call limit ${maxCalls} exceeded`);
      let args;
      try {
        args = JSON.parse(call.arguments || "{}");
      } catch {
        throw new Error(`Invalid JSON arguments for ${call.name}`);
      }
      const signature = `${call.name}:${JSON.stringify(args, Object.keys(args).sort())}`;
      if (signatures.has(signature)) throw new Error(`Tool call repeated: ${call.name}`);
      signatures.add(signature);
      const started = Date.now();
      const result = await handlers[call.name](args);
      const safeResult = redact(result);
      trace.push({
        tool: call.name,
        parameters: redact(args),
        result: safeResult,
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - started,
      });
      history.push({ type: "function_call_output", call_id: call.call_id, output: JSON.stringify(safeResult) });
    }
  }
}
