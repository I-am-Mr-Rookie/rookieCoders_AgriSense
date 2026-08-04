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
      interpretConversationTurn: () => ({
        kind: "general",
        assistant: "",
        pendingField: "",
        patch: {},
        changedFields: [],
      }),
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
      briefCropCandidates: async ({ crops }) => crops.map((crop) => ({
        ...crop,
        summary: `${crop.name} summary`,
        pros: ["Grounded advantage"],
        cons: ["Grounded limitation"],
      })),
      answerGeneralFarmerQuestion: async () => "How can I help with your farm today?",
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
        appendConversationTurn: async (memoryId, value) => {
          savedMemories.push({ memoryId, conversation: structuredClone(value) });
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

test("chat turns ask for a missing revision value without starting planning", async () => {
  let weatherCalls = 0;
  let extractionCalls = 0;
  const existingPlan = { crops: [{ id: "maize" }] };
  const { deps, savedSessions } = dependencies({
    loadSession: async (id) => ({
      id,
      profile: completeProfile(),
      lastResult: existingPlan,
    }),
    interpretConversationTurn: () => ({
      kind: "clarify_value",
      assistant: "I have your current total season budget saved as BDT 90,000. What should the new budget be?",
      pendingField: "budgetBdt",
      patch: {},
      changedFields: [],
    }),
    extractProfilePatch: async () => {
      extractionCalls += 1;
      return {};
    },
    getWeather: async () => {
      weatherCalls += 1;
      return {};
    },
  });

  const result = await createPlanningWorkflow(deps)({
    action: "chat",
    sessionId: "session-revision-question",
    message: "I want to change my budget.",
  });

  assert.equal(result.kind, "clarify_value");
  assert.equal(result.pendingField, "budgetBdt");
  assert.equal(result.readyToPlan, false);
  assert.equal(result.planStale, false);
  assert.equal(result.assistant, "I have your current total season budget saved as BDT 90,000. What should the new budget be?");
  assert.equal(weatherCalls, 0);
  assert.equal(extractionCalls, 0);
  assert.equal(savedSessions.length, 0);
});

test("rehydrates a stale recovery code from the validated client profile after a local restart", async () => {
  const recovered = [];
  const memoryService = {
    load: async () => null,
    ensure: async (memoryId, initial) => {
      recovered.push({ memoryId, initial: structuredClone(initial) });
      return structuredClone(initial);
    },
    savePlan: async (_memoryId, value) => value,
    appendConversationTurn: async (_memoryId, value) => value,
  };
  const { deps } = dependencies({ memoryService });
  const run = createPlanningWorkflow(deps);

  const result = await run({
    action: "plan",
    sessionId: "session-recovered",
    memoryId: "farm_0123456789abcdefghijklmn",
    memorySessionId: "session-recovered",
    profilePatch: completeProfile(),
    selectedCropId: "maize",
  });

  assert.equal(result.profile.location, "Gazipur");
  assert.equal(result.seasonPlan.length, 2);
  assert.equal(recovered.length, 1);
  assert.deepEqual(recovered[0].initial.profile, completeProfile());
  assert.equal(recovered[0].initial.sessions[0].id, "session-recovered");
});

test("a new general chat still uses model intake when an older plan exists", async () => {
  let extractionCalls = 0;
  let weatherCalls = 0;
  const existingPlan = { crops: [{ id: "maize" }], explanation: "Previous plan" };
  const { deps, savedSessions } = dependencies({
    loadSession: async (id) => ({
      id,
      profile: completeProfile(),
      lastResult: existingPlan,
    }),
    interpretConversationTurn: () => ({
      kind: "general",
      assistant: "",
      pendingField: "",
      patch: {},
      changedFields: [],
    }),
    extractProfilePatch: async () => {
      extractionCalls += 1;
      return { location: "Pabna" };
    },
    getWeather: async () => {
      weatherCalls += 1;
      return {};
    },
  });

  const result = await createPlanningWorkflow(deps)({
    action: "chat",
    sessionId: "new-chat-with-history",
    message: "Suggest me a budget for cultivating crops in Pabna",
  });

  assert.equal(extractionCalls, 1);
  assert.equal(weatherCalls, 0);
  assert.equal(result.kind, "revision_staged");
  assert.equal(result.profile.location, "Pabna");
  assert.equal(result.planStale, true);
  assert.deepEqual(savedSessions.at(-1).lastResult, existingPlan);
});

test("an open-ended farmer request is answered by the agent without forcing profile intake", async () => {
  let assistanceCalls = 0;
  let extractionCalls = 0;
  const { deps } = dependencies({
    extractProfilePatch: async () => {
      extractionCalls += 1;
      return {};
    },
    getMissingFields: () => ["location", "farmSizeAcres", "targetSeason"],
    answerGeneralFarmerQuestion: async ({ message, responseLanguage }) => {
      assistanceCalls += 1;
      assert.equal(message, "My area is flooding. What should I do?");
      assert.equal(responseLanguage, "English");
      return "Move people and livestock to higher ground first, and follow official local evacuation advice.";
    },
  });

  const result = await createPlanningWorkflow(deps)({
    action: "chat",
    sessionId: "flood-help",
    message: "My area is flooding. What should I do?",
    responseLanguage: "English",
  });

  assert.equal(assistanceCalls, 1);
  assert.equal(extractionCalls, 0);
  assert.equal(result.kind, "general_assistance");
  assert.deepEqual(result.missingFields, []);
  assert.match(result.assistant, /higher ground/);
});

test("newer session facts override stale cross-session memory", async () => {
  const current = { ...completeProfile(), budgetBdt: 100000 };
  const stale = { ...completeProfile(), budgetBdt: 50000 };
  const { deps } = dependencies({
    loadSession: async (id) => ({ id, profile: current, lastResult: null }),
    interpretFarmerTurn: async () => ({
      kind: "general",
      assistant: "Your current budget is BDT 100,000.",
      pendingField: "",
      patch: {},
      changedFields: [],
      selectedCropId: "",
    }),
    getMissingFields: () => [],
    answerGeneralFarmerQuestion: async () => "Your current budget is BDT 100,000.",
    memoryService: {
      load: async () => ({ profile: stale, preferences: {}, conversationSummary: "" }),
      savePlan: async (_id, value) => value,
      appendConversationTurn: async (_id, value) => value,
    },
  });

  const result = await createPlanningWorkflow(deps)({
    action: "chat",
    sessionId: "newer-budget-session",
    memoryId: "farm_0123456789abcdefghijklmn",
    message: "What budget do you remember?",
  });

  assert.equal(result.profile.budgetBdt, 100000);
});

test("LLM turn interpretation can request another crop plan after a completed plan", async () => {
  const { deps } = dependencies({
    loadSession: async (id) => ({
      id,
      profile: completeProfile(),
      lastResult: { selectedCropId: "mustard" },
    }),
    interpretFarmerTurn: async () => ({
      kind: "request_plan",
      assistant: "I will create a fresh maize plan using your saved farm details.",
      pendingField: "",
      patch: {},
      changedFields: [],
      selectedCropId: "maize",
    }),
    getMissingFields: () => [],
  });

  const result = await createPlanningWorkflow(deps)({
    action: "chat",
    sessionId: "another-crop-plan",
    message: "Now make another plan for maize instead.",
  });

  assert.deepEqual(result.planRequest, { action: "plan", selectedCropId: "maize" });
  assert.match(result.assistant, /fresh maize plan/i);
});

test("chat turns persist a staged revision without replacing the existing plan", async () => {
  let weatherCalls = 0;
  const existingPlan = { crops: [{ id: "maize" }], explanation: "Previous plan" };
  const { deps, savedSessions, savedMemories } = dependencies({
    loadSession: async (id) => ({
      id,
      profile: completeProfile(),
      lastResult: existingPlan,
    }),
    interpretConversationTurn: () => ({
      kind: "revision_staged",
      assistant: "Budget updated from BDT 90,000 to BDT 40,000.",
      pendingField: "",
      patch: { budgetBdt: 40000 },
      changedFields: ["budgetBdt"],
    }),
    getWeather: async () => {
      weatherCalls += 1;
      return {};
    },
    memoryService: {
      load: async () => ({
        profile: completeProfile(),
        lastResult: existingPlan,
        preferences: { autoAdjustIrrigation: true },
        conversationSummary: "Existing summary.",
      }),
      savePlan: async (memoryId, value) => {
        savedMemories.push({ memoryId, value: structuredClone(value) });
        return value;
      },
    },
  });

  const result = await createPlanningWorkflow(deps)({
    action: "chat",
    sessionId: "session-revision-value",
    memoryId: "farm_0123456789abcdefghijklmn",
    message: "BDT 40,000",
    pendingField: "budgetBdt",
  });

  assert.equal(result.kind, "revision_staged");
  assert.equal(result.profile.budgetBdt, 40000);
  assert.equal(result.readyToPlan, true);
  assert.equal(result.planStale, true);
  assert.deepEqual(result.changedFields, ["budgetBdt"]);
  assert.equal(weatherCalls, 0);
  assert.equal(savedSessions.at(-1).profile.budgetBdt, 40000);
  assert.deepEqual(savedSessions.at(-1).lastResult, existingPlan);
  assert.equal(savedMemories[0].value.profile.budgetBdt, 40000);
  assert.deepEqual(savedMemories[0].value.lastResult, existingPlan);
  assert.match(savedMemories[0].value.conversationSummary, /budget/i);
});

test("explicit plan action uses the staged session profile", async () => {
  let extractionCalls = 0;
  let rankedBudget = null;
  const { deps } = dependencies({
    loadSession: async (id) => ({
      id,
      profile: { ...completeProfile(), budgetBdt: 40000 },
      lastResult: { crops: [{ id: "maize" }] },
    }),
    extractProfilePatch: async () => {
      extractionCalls += 1;
      return {};
    },
    rankCrops: (profile) => {
      rankedBudget = profile.budgetBdt;
      return [{
        id: "mustard",
        name: "Mustard",
        financials: { costBreakdownBdt: { fertilizer: 100, irrigation: 80 } },
      }];
    },
  });

  const result = await createPlanningWorkflow(deps)({
    action: "plan",
    sessionId: "session-revision-plan",
    startDate: "2026-11-01",
  });

  assert.equal(extractionCalls, 0);
  assert.equal(rankedBudget, 40000);
  assert.equal(result.profile.budgetBdt, 40000);
  assert.equal(result.crops[0].id, "mustard");
});

test("analysis returns four choices without generating a full plan", async () => {
  const ranked = ["mustard", "maize", "potato", "boro-rice"].map((id, index) => ({
    id,
    name: id,
    plannedAreaAcres: 1,
    plannedFinancials: { netProfitBdt: 100, costBreakdownBdt: { fertilizer: 20, irrigation: 10 } },
    sources: [],
  }));
  const { deps } = dependencies({ rankCrops: () => ranked });

  const result = await createPlanningWorkflow(deps)({
    action: "analyze",
    sessionId: "candidate-analysis",
    profilePatch: completeProfile(),
  });

  assert.equal(result.candidateSelectionRequired, true);
  assert.equal(result.candidates.length, 4);
  assert.equal(result.seasonPlan, undefined);
  assert.equal(result.inputSchedule, undefined);
});

test("selected crop creates the only full plan and keeps original farm facts", async () => {
  const ranked = ["mustard", "maize", "potato", "boro-rice"].map((id, index) => ({
    id,
    name: id,
    plannedAreaAcres: index + 1,
    plannedFinancials: { netProfitBdt: 100, costBreakdownBdt: { fertilizer: 20, irrigation: 10 } },
    sources: [],
  }));
  let planCropId;
  const { deps } = dependencies({
    rankCrops: () => ranked,
    buildSeasonPlan: (cropId) => {
      planCropId = cropId;
      return [
        { stage: "fertilizer", date: "2026-11-23", evidence: [] },
        { stage: "irrigation", date: "2026-12-06", evidence: [] },
      ];
    },
  });

  const result = await createPlanningWorkflow(deps)({
    action: "plan",
    selectedCropId: "potato",
    sessionId: "candidate-selection",
    profilePatch: completeProfile(),
  });

  assert.equal(planCropId, "potato");
  assert.equal(result.selectedCropId, "potato");
  assert.equal(result.crops.length, 1);
  assert.equal(result.crops[0].id, "potato");
  assert.equal(result.profile.farmSizeAcres, 1);
  assert.equal(result.plannedAreaAcres, 3);
});

test("connected chat turns append only the visible farmer and assistant messages", async () => {
  const appended = [];
  const { deps } = dependencies({
    loadSession: async (id) => ({
      id,
      profile: completeProfile(),
      lastResult: { crops: [{ id: "maize" }] },
    }),
    interpretConversationTurn: () => ({
      kind: "clarify_value",
      assistant: "I have your current total season budget saved as BDT 90,000. What should the new budget be?",
      pendingField: "budgetBdt",
      patch: {},
      changedFields: [],
    }),
    memoryService: {
      load: async () => ({
        profile: completeProfile(),
        lastResult: null,
        sessions: [{ id: "chat-budget", lastResult: { crops: [{ id: "maize" }] } }],
        preferences: {},
        conversationSummary: "",
      }),
      appendConversationTurn: async (memoryId, value) => {
        appended.push({ memoryId, value: structuredClone(value) });
      },
    },
  });

  await createPlanningWorkflow(deps)({
    action: "chat",
    sessionId: "chat-budget",
    memoryId: "farm_0123456789abcdefghijklmn",
    memorySessionId: "chat-budget",
    message: "I want to change my budget.",
  });

  assert.deepEqual(appended[0].value, {
    sessionId: "chat-budget",
    messages: [
      { role: "farmer", text: "I want to change my budget." },
      { role: "agent", text: "I have your current total season budget saved as BDT 90,000. What should the new budget be?" },
    ],
    conversationSummary: "Location=Gazipur | Area=1ac | Soil=loam | Water=irrigated | Budget=BDT90000 | Season=Rabi",
  });
  assert.equal(JSON.stringify(appended).includes("farm_0123456789abcdefghijklmn"), true);
});

test("explicit planning attaches the result to the active memory session", async () => {
  const savedPlans = [];
  const appended = [];
  const { deps } = dependencies({
    loadSession: async (id) => ({
      id,
      profile: { ...completeProfile(), budgetBdt: 40000 },
      lastResult: null,
    }),
    memoryService: {
      load: async () => ({
        profile: { ...completeProfile(), budgetBdt: 40000 },
        lastResult: null,
        sessions: [{ id: "chat-budget", lastResult: null }],
        preferences: {},
        conversationSummary: "",
      }),
      savePlan: async (_memoryId, value) => savedPlans.push(structuredClone(value)),
      appendConversationTurn: async (_memoryId, value) => appended.push(structuredClone(value)),
    },
  });

  await createPlanningWorkflow(deps)({
    action: "plan",
    sessionId: "chat-budget",
    memoryId: "farm_0123456789abcdefghijklmn",
    memorySessionId: "chat-budget",
  });

  assert.equal(savedPlans[0].memorySessionId, "chat-budget");
  assert.equal(savedPlans[0].lastResult.crops[0].id, "maize");
  assert.deepEqual(appended[0].messages, [
    { role: "agent", text: "**Maize** is the grounded recommendation." },
  ]);
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
