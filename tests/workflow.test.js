import test from "node:test";
import assert from "node:assert/strict";

import { createPlanningWorkflow } from "../server/workflow.js";

function completeProfile() {
  return {
    location: "Gazipur",
    farmSizeAcres: 1,
    soilType: "loam",
    waterAvailability: "irrigated",
    budgetBdt: 90000,
    targetSeason: "Rabi",
  };
}

function dependencies(overrides = {}) {
  const savedSessions = [];
  const savedMemories = [];
  return {
    savedSessions,
    savedMemories,
    deps: {
      loadSession: async (id) => ({ id, profile: {}, lastResult: null }),
      saveSession: async (session) => savedSessions.push(structuredClone(session)),
      extractProfilePatch: async () => completeProfile(),
      validateProfilePatch: (value) => value,
      getMissingFields: () => [],
      getWeather: async () => ({
        source: "Open-Meteo",
        sourceUrl: "https://api.open-meteo.com/v1/forecast",
        precipitationMm: 18,
        meanTemperatureC: 25,
        daily: { time: ["2026-07-26"], precipitation_sum: [18] },
      }),
      getCropEvidence: () => ({ sources: [] }),
      retrieveFacts: () => ({ results: [] }),
      rankCrops: () => [{
        id: "maize",
        name: "Maize",
        financials: { costBreakdownBdt: { fertilizer: 100, irrigation: 80 } },
      }],
      getPlanEvidence: () => ({}),
      buildSeasonPlan: () => [
        { stage: "fertilizer", date: "2026-07-25", evidence: [] },
        { stage: "irrigation", date: "2026-07-26", evidence: [] },
      ],
      buildInputSchedule: () => [{ id: "irrigation", adjustedDate: "2026-07-30" }],
      loadCorpus: () => ({ report: { totalIndexed: 1976, datasetCount: 9 } }),
      createTraceEntry: (tool, parameters, result, durationMs) => ({
        tool,
        parameters,
        result,
        durationMs,
        timestamp: "2026-07-24T19:00:00.000Z",
      }),
      openAiMode: () => "gpt-5.6-sol/adaptive-medium-high",
      explainRecommendation: async () => ({
        text: "**Maize** is the grounded recommendation.",
        trace: [{ tool: "inspect_weather", durationMs: 1 }],
        reasoningSummaries: ["Checked weather and evidence."],
        mode: "gpt-5.6-sol/medium/tool-loop",
        usage: { total_tokens: 100 },
      }),
      memoryService: {
        load: async () => ({
          profile: { location: "Gazipur" },
          preferences: { autoAdjustIrrigation: true },
          conversationSummary: "",
        }),
        save: async (memoryId, value) => {
          savedMemories.push({ memoryId, value: structuredClone(value) });
          return value;
        },
        savePlan: async (memoryId, value) => {
          savedMemories.push({ memoryId, value: structuredClone(value) });
          return value;
        },
      },
      now: () => new Date("2026-07-24T19:00:00.000Z"),
      ...overrides,
    },
  };
}

test("runs the planning workflow with ordered truthful activity and a Tier 1 schedule", async () => {
  const { deps, savedSessions, savedMemories } = dependencies();
  const events = [];
  const run = createPlanningWorkflow(deps);

  const result = await run({
    sessionId: "session-1",
    memoryId: "farm_0123456789abcdefghijklmn",
    message: "Plan my farm",
    startDate: "2026-06-21",
  }, (event) => events.push(event));

  assert.equal(result.inputSchedule[0].id, "irrigation");
  assert.deepEqual(result.reasoningSummaries, ["Checked weather and evidence."]);
  assert.equal(result.memoryConnected, true);
  assert.equal(savedSessions.at(-1).lastResult.inputSchedule[0].adjustedDate, "2026-07-30");
  assert.equal(savedMemories.length, 1);
  assert.equal(savedMemories[0].value.profile.location, "Gazipur");
  assert.deepEqual(
    events.map((event) => event.type),
    [
      "request.accepted",
      "memory.loaded",
      "profile.updated",
      "weather.fetch.started",
      "weather.fetch.completed",
      "rag.retrieve.started",
      "rag.retrieve.completed",
      "crops.rank.completed",
      "scheduler.completed",
      "agent.response.started",
      "agent.response.completed",
      "memory.saved",
      "request.completed",
    ],
  );
  assert.equal(JSON.stringify(events).includes("farm_0123456789abcdefghijklmn"), false);
});

test("returns targeted missing fields before running weather or the agent", async () => {
  let weatherCalls = 0;
  const { deps } = dependencies({
    extractProfilePatch: async () => ({ location: "Gazipur" }),
    getMissingFields: () => ["budgetBdt"],
    getWeather: async () => {
      weatherCalls += 1;
      return {};
    },
  });
  const events = [];

  const result = await createPlanningWorkflow(deps)({
    sessionId: "session-2",
    message: "I am in Gazipur",
  }, (event) => events.push(event));

  assert.deepEqual(result.missingFields, ["budgetBdt"]);
  assert.equal(weatherCalls, 0);
  assert.equal(events.at(-1).type, "request.completed");
  assert.equal(events.some((event) => event.type === "agent.response.started"), false);
});

test("returns bounded phase timings for latency diagnosis without exposing secrets", async () => {
  let milliseconds = 0;
  const { deps } = dependencies({
    now: () => new Date(milliseconds += 10),
  });

  const result = await createPlanningWorkflow(deps)({
    sessionId: "session-timing",
    profilePatch: completeProfile(),
  });

  assert.deepEqual(Object.keys(result.timings), [
    "weatherMs",
    "retrievalMs",
    "agentMs",
    "totalMs",
  ]);
  assert.equal(Object.values(result.timings).every(Number.isFinite), true);
  assert.equal(result.timings.totalMs >= result.timings.agentMs, true);
  assert.equal(JSON.stringify(result.timings).includes("session-timing"), false);
});

test("redacts recovery credentials before profile extraction and explanation", async () => {
  const edgeCaseId = `farm_${"a".repeat(23)}-`;
  const seen = [];
  const { deps } = dependencies({
    extractProfilePatch: async (message) => {
      seen.push(message);
      return completeProfile();
    },
    explainRecommendation: async (context) => {
      seen.push(context.userMessage);
      return {
        text: "Safe response.",
        trace: [],
        reasoningSummaries: [],
        mode: "test",
      };
    },
  });

  await createPlanningWorkflow(deps)({
    sessionId: "session-redaction",
    message: `My code is ${edgeCaseId}`,
  });

  assert.equal(seen.length, 2);
  assert.equal(seen.every((value) => value.includes("[REDACTED_RECOVERY_ID]")), true);
  assert.equal(JSON.stringify(seen).includes(edgeCaseId), false);
});

test("stops before ranking, model work, and final persistence when the client aborts", async () => {
  const controller = new AbortController();
  let rankCalls = 0;
  let explanationCalls = 0;
  const { deps, savedSessions } = dependencies({
    getWeather: async () => {
      controller.abort();
      return {
        source: "Open-Meteo",
        sourceUrl: "https://api.open-meteo.com/v1/forecast",
        precipitationMm: 10,
        meanTemperatureC: 25,
        daily: { time: [], precipitation_sum: [] },
      };
    },
    rankCrops: () => {
      rankCalls += 1;
      return [];
    },
    explainRecommendation: async () => {
      explanationCalls += 1;
      return {};
    },
  });

  await assert.rejects(
    createPlanningWorkflow(deps)({
      sessionId: "session-abort",
      profilePatch: completeProfile(),
    }, () => {}, controller.signal),
    /abort/i,
  );

  assert.equal(rankCalls, 0);
  assert.equal(explanationCalls, 0);
  assert.equal(savedSessions.length, 1);
  assert.equal(savedSessions[0].lastResult, null);
});

test("rolls back a final session save when cancellation arrives during persistence", async () => {
  const controller = new AbortController();
  const saved = [];
  const { deps } = dependencies({
    saveSession: async (session) => {
      saved.push(structuredClone(session));
      if (saved.length === 2) controller.abort();
    },
  });

  await assert.rejects(
    createPlanningWorkflow(deps)({
      sessionId: "session-save-abort",
      profilePatch: completeProfile(),
    }, () => {}, controller.signal),
    /abort/i,
  );

  assert.equal(saved.length, 3);
  assert.equal(saved[1].lastResult.crops[0].id, "maize");
  assert.equal(saved[2].lastResult, null);
});
