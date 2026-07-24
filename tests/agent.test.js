import test from "node:test";
import assert from "node:assert/strict";

import { runToolLoop } from "../server/agent.js";

function fakeClient(outputs) {
  let index = 0;
  const requests = [];
  return {
    responses: {
      async create(request) {
        requests.push(request);
        return outputs[index++];
      },
    },
    calls() {
      return index;
    },
    requests() {
      return requests;
    },
  };
}

test("executes an allow-listed function and round-trips its output", async () => {
  const client = fakeClient([
    {
      id: "resp_1",
      output: [
        { type: "reasoning", id: "rs_1", summary: [] },
        { type: "function_call", id: "fc_1", call_id: "call_1", name: "get_weather", arguments: "{\"location\":\"Gazipur\"}" },
      ],
      output_text: "",
    },
    {
      id: "resp_2",
      output: [{ type: "message", role: "assistant", content: [{ type: "output_text", text: "Mustard is the best fit." }] }],
      output_text: "Mustard is the best fit.",
      usage: { total_tokens: 120 },
    },
  ]);

  const result = await runToolLoop({
    client,
    model: "gpt-5.6-sol",
    input: [{ role: "user", content: "Plan my Gazipur farm" }],
    toolDefinitions: [{ type: "function", name: "get_weather", parameters: { type: "object" } }],
    handlers: {
      get_weather: async ({ location }) => ({ location, precipitationMm: 12.5 }),
    },
  });

  assert.equal(result.text, "Mustard is the best fit.");
  assert.equal(result.trace.length, 1);
  assert.equal(result.trace[0].tool, "get_weather");
  assert.equal(result.trace[0].result.precipitationMm, 12.5);
  assert.equal(client.calls(), 2);
  assert.equal(client.requests()[0].parallel_tool_calls, true);
  assert.deepEqual(client.requests()[0].reasoning, { effort: "medium", summary: "auto" });
});

test("returns only API-provided reasoning summaries and never raw reasoning content", async () => {
  const client = fakeClient([
    {
      id: "resp_summary",
      output: [
        {
          type: "reasoning",
          summary: [{ type: "summary_text", text: "Checked the forecast and farm constraints." }],
          encrypted_content: "private-encrypted-content",
          content: "private raw reasoning",
        },
        { type: "message", role: "assistant", content: [{ type: "output_text", text: "Done." }] },
      ],
      output_text: "Done.",
    },
  ]);

  const result = await runToolLoop({ client, input: "run" });

  assert.deepEqual(result.reasoningSummaries, ["Checked the forecast and farm constraints."]);
  assert.equal(JSON.stringify(result).includes("private raw reasoning"), false);
  assert.equal(JSON.stringify(result).includes("private-encrypted-content"), false);
});

test("redacts secret-shaped fields from tool traces", async () => {
  const client = fakeClient([
    {
      id: "resp_1",
      output: [{ type: "function_call", call_id: "call_1", name: "safe_tool", arguments: "{}" }],
      output_text: "",
    },
    { id: "resp_2", output: [], output_text: "done" },
  ]);

  const result = await runToolLoop({
    client,
    input: "run",
    toolDefinitions: [{ type: "function", name: "safe_tool", parameters: { type: "object" } }],
    handlers: {
      safe_tool: async () => ({ apiKey: "sk-secret-value", password: "hidden", safe: "visible" }),
    },
  });

  assert.equal(result.trace[0].result.apiKey, "[REDACTED]");
  assert.equal(result.trace[0].result.password, "[REDACTED]");
  assert.equal(result.trace[0].result.safe, "visible");
});

test("rejects unknown and repeated tool calls", async () => {
  const unknown = fakeClient([
    {
      id: "resp_unknown",
      output: [{ type: "function_call", call_id: "call_x", name: "delete_everything", arguments: "{}" }],
      output_text: "",
    },
  ]);

  await assert.rejects(
    runToolLoop({ client: unknown, input: "run", toolDefinitions: [], handlers: {} }),
    /not allowed/,
  );

  const repeated = fakeClient([
    {
      id: "resp_1",
      output: [{ type: "function_call", call_id: "call_1", name: "safe_tool", arguments: "{\"value\":1}" }],
      output_text: "",
    },
    {
      id: "resp_2",
      output: [{ type: "function_call", call_id: "call_2", name: "safe_tool", arguments: "{\"value\":1}" }],
      output_text: "",
    },
  ]);

  await assert.rejects(
    runToolLoop({
      client: repeated,
      input: "run",
      toolDefinitions: [{ type: "function", name: "safe_tool", parameters: { type: "object" } }],
      handlers: { safe_tool: async ({ value }) => ({ value }) },
    }),
    /repeated/,
  );
});

test("stops before executing more than the configured tool-call limit", async () => {
  const calls = Array.from({ length: 9 }, (_, index) => ({
    type: "function_call",
    call_id: `call_${index}`,
    name: "safe_tool",
    arguments: `{"value":${index}}`,
  }));
  const client = fakeClient([{ id: "resp_many", output: calls, output_text: "" }]);

  await assert.rejects(
    runToolLoop({
      client,
      input: "run",
      maxCalls: 8,
      toolDefinitions: [{ type: "function", name: "safe_tool", parameters: { type: "object" } }],
      handlers: { safe_tool: async ({ value }) => ({ value }) },
    }),
    /Tool-call limit 8 exceeded/,
  );
});
