import { createActivityEmitter } from "./activity.js";
import { buildCompactMemorySummary } from "./memory-summary.js";
import { redactRecoveryIds } from "../shared/redaction.js";

const FIELD_LABELS = {
  location: "location in Bangladesh",
  farmSizeAcres: "farm size in acres",
  soilType: "soil type",
  waterAvailability: "water availability",
  budgetBdt: "budget in BDT",
  targetSeason: "target season",
};

function revisionSummary(previousSummary, changedFields) {
  const labels = changedFields.map((field) => FIELD_LABELS[field] ?? field).join(", ");
  const note = `Farmer updated ${labels}; plan regeneration pending.`;
  return [String(previousSummary || "").trim(), note]
    .filter(Boolean)
    .join(" ")
    .slice(-2000);
}

export function createPlanningWorkflow(deps) {
  const clock = () => deps.now?.() ?? new Date();

  return async function run(body, onEvent = () => {}, signal) {
    const throwIfAborted = () => signal?.throwIfAborted();
    throwIfAborted();
    const startedAt = clock().getTime();
    const emit = createActivityEmitter(onEvent, clock);
    const isChatTurn = body.action === "chat";
    if (!isChatTurn) {
      await emit("request.accepted", "Request accepted", "running", {
        hasMessage: Boolean(String(body.message || "").trim()),
        hasStructuredProfile: Boolean(body.profilePatch),
      });
    }

    const sessionId = String(body.sessionId || deps.createSessionId());
    const session = await deps.loadSession(sessionId);
    const previousLastResult = session.lastResult;
    let memory = null;
    if (body.memoryId) {
      memory = await deps.memoryService.load(body.memoryId);
      if (!memory) throw new Error("Farmer memory was not found.");
      session.profile = { ...session.profile, ...memory.profile };
      const memorySession = memory.sessions?.find((item) => item.id === body.memorySessionId);
      if (!session.lastResult && memorySession?.lastResult) {
        session.lastResult = memorySession.lastResult;
      }
      if (!isChatTurn) {
        await emit("memory.loaded", "Saved farm memory loaded", "completed", {
          profileFields: Object.keys(memory.profile || {}),
          hasPreviousPlan: Boolean(memory.lastResult),
        });
      }
    }

    const message = redactRecoveryIds(body.message);
    const preferences = {
      autoAdjustIrrigation: typeof body.preferences?.autoAdjustIrrigation === "boolean"
        ? body.preferences.autoAdjustIrrigation
        : memory?.preferences?.autoAdjustIrrigation !== false,
    };
    if (isChatTurn) {
      const currentPlan = session.lastResult ?? memory?.lastResult ?? null;
      const turn = deps.interpretConversationTurn(message, session.profile, {
        pendingField: body.pendingField,
        awaitingField: body.awaitingField === true,
      });
      let patch = {};
      if (turn.kind === "revision_staged") {
        patch = deps.validateProfilePatch(turn.patch);
      } else if (!currentPlan && turn.kind === "general") {
        patch = deps.validateProfilePatch(
          body.profilePatch ?? await deps.extractProfilePatch(message, session.profile, signal),
        );
      }
      throwIfAborted();

      if (Object.keys(patch).length) {
        session.profile = { ...session.profile, ...patch };
        await deps.saveSession(session);
      }

      const missingFields = deps.getMissingFields(session.profile);
      const changedFields = Object.keys(patch);
      const readyToPlan = changedFields.length > 0 && missingFields.length === 0;
      const planStale = readyToPlan && Boolean(currentPlan);
      const summary = buildCompactMemorySummary({
        profile: session.profile,
        previousSummary: memory?.conversationSummary,
        message,
      }) || revisionSummary(memory?.conversationSummary, changedFields);

      let savedMemory = memory;
      if (body.memoryId && changedFields.length) {
        savedMemory = await deps.memoryService.savePlan(body.memoryId, {
          profile: session.profile,
          lastResult: currentPlan,
          conversationSummary: summary,
          memorySessionId: body.memorySessionId,
        }, { signal });
      }

      const kind = turn.kind === "general" && changedFields.length
        ? readyToPlan ? "revision_staged" : "intake_updated"
        : turn.kind;
      const assistant = turn.assistant || (
        missingFields.length
          ? `I still need: ${missingFields.map((field) => FIELD_LABELS[field]).join(", ")}.`
          : changedFields.length
            ? "Your farm details are ready. Review them, then create the plan."
            : "I can help revise your budget, farm size, soil, water availability, location, or season."
      );
      if (body.memoryId && body.memorySessionId) {
        savedMemory = await deps.memoryService.appendConversationTurn(body.memoryId, {
          sessionId: body.memorySessionId,
          messages: [
            { role: "farmer", text: message },
            { role: "agent", text: assistant },
          ],
          conversationSummary: summary,
        });
      }

      return {
        sessionId,
        profile: session.profile,
        memoryConnected: Boolean(body.memoryId),
        kind,
        assistant,
        pendingField: turn.pendingField,
        changedFields,
        missingFields,
        readyToPlan,
        planStale,
        memory: savedMemory,
      };
    }

    const patch = deps.validateProfilePatch(
      body.profilePatch ?? (
        body.action === "plan"
          ? {}
          : await deps.extractProfilePatch(message, session.profile, signal)
      ),
    );
    throwIfAborted();
    session.profile = { ...session.profile, ...patch };
    await deps.saveSession(session);
    await emit("profile.updated", "Farm profile updated", "completed", {
      updatedFields: Object.keys(patch),
      completeFields: Object.keys(session.profile),
    });

    const missingFields = deps.getMissingFields(session.profile);
    if (missingFields.length) {
      if (body.memoryId) {
        await deps.memoryService.savePlan(body.memoryId, {
          profile: session.profile,
          lastResult: memory?.lastResult ?? null,
          conversationSummary: memory?.conversationSummary ?? "",
        }, { signal });
      }
      const result = {
        sessionId,
        profile: session.profile,
        missingFields,
        memoryConnected: Boolean(body.memoryId),
        assistant: `I still need: ${missingFields.map((field) => FIELD_LABELS[field]).join(", ")}.`,
      };
      await emit("request.completed", "More farm details needed", "completed", {
        missingFields,
        totalDurationMs: clock().getTime() - startedAt,
      });
      return result;
    }

    const trace = [];
    let phaseStarted = clock().getTime();
    await emit("weather.fetch.started", "Checking the live forecast", "running", {
      provider: "Open-Meteo",
      location: session.profile.location,
    });
    const weather = await deps.getWeather(session.profile.location, { signal });
    throwIfAborted();
    const weatherDuration = clock().getTime() - phaseStarted;
    trace.push(deps.createTraceEntry(
      "weather.getForecast",
      { location: session.profile.location, days: 7 },
      weather,
      weatherDuration,
    ));
    await emit("weather.fetch.completed", "Live forecast retrieved", "completed", {
      provider: weather.source,
      sourceUrl: weather.sourceUrl,
      precipitationMm: weather.precipitationMm,
      meanTemperatureC: weather.meanTemperatureC,
    }, weatherDuration);

    phaseStarted = clock().getTime();
    await emit("rag.retrieve.started", "Retrieving Bangladesh agronomy evidence", "running", {
      datasets: deps.loadCorpus().report.datasetCount,
    });
    const cropIds = ["mustard", "potato", "maize", "boro-rice"];
    const evidenceByCrop = Object.fromEntries(
      cropIds.map((id) => [id, deps.getCropEvidence(session.profile, id)]),
    );
    const knowledge = deps.retrieveFacts(
      `${session.profile.targetSeason} ${session.profile.soilType} fertilizer irrigation ${session.profile.location}`,
      { topK: 6 },
    ).results.map((item) => ({
      id: item.id,
      dataset: item.dataset,
      crop: item.crop,
      title: item.provenance.sourceTitle,
      publisher: item.provenance.publisher,
      sourceUrl: item.provenance.sourceUrl,
      sourcePage: item.provenance.sourcePage,
      confidence: item.provenance.confidence,
      text: item.text.slice(0, 520),
    }));
    const retrievalDuration = clock().getTime() - phaseStarted;
    throwIfAborted();
    trace.push(deps.createTraceEntry(
      "rag.retrieve",
      { query: `${session.profile.targetSeason} ${session.profile.soilType}`, cropCount: cropIds.length, limit: 6 },
      { evidenceByCrop, knowledge },
      retrievalDuration,
    ));
    await emit("rag.retrieve.completed", "Agronomy evidence retrieved", "completed", {
      resultCount: knowledge.length,
      sourceDomains: [...new Set(knowledge.map((item) => {
        try {
          return new URL(item.sourceUrl).hostname;
        } catch {
          return "unknown";
        }
      }))],
    }, retrievalDuration);

    const crops = deps.rankCrops(session.profile, weather, evidenceByCrop);
    trace.push(deps.createTraceEntry(
      "crops.rank",
      {
        profile: session.profile,
        weather: {
          precipitationMm: weather.precipitationMm,
          meanTemperatureC: weather.meanTemperatureC,
        },
      },
      crops.map(({ id, suitability, roughProfitBdt }) => ({ id, suitability, roughProfitBdt })),
      0,
    ));
    await emit("crops.rank.completed", "Crop options ranked", "completed", {
      topCrop: crops[0].name,
      candidateCount: crops.length,
    }, 0);

    const startDate = body.startDate || "2026-11-01";
    const planEvidence = deps.getPlanEvidence(crops[0].id, session.profile);
    const seasonPlan = deps.buildSeasonPlan(crops[0].id, startDate, planEvidence);
    trace.push(deps.createTraceEntry(
      "season.build",
      { cropId: crops[0].id, startDate },
      seasonPlan,
      0,
    ));
    const inputSchedule = deps.buildInputSchedule({
      crop: crops[0],
      profile: session.profile,
      weather,
      seasonPlan,
      preferences,
    });
    trace.push(deps.createTraceEntry(
      "scheduler.build",
      { cropId: crops[0].id, startDate },
      inputSchedule,
      0,
    ));
    await emit("scheduler.completed", "Input schedule prepared", "completed", {
      scheduleItems: inputSchedule.length,
      automaticAdjustments: inputSchedule.filter((item) => item.autoAdjusted).length,
      confirmationRequired: inputSchedule.filter((item) => item.status === "REQUIRES_FARMER_CONFIRMATION").length,
    }, 0);

    const rag = {
      ...deps.loadCorpus().report,
      retrieval: "in-process structured lexical retrieval",
      embeddingMode: "not used",
    };
    phaseStarted = clock().getTime();
    await emit("agent.response.started", "AgriSense is checking tools and explaining the plan", "running", {
      model: deps.openAiMode(),
    });
    const compactSummary = buildCompactMemorySummary({
      profile: session.profile,
      previousSummary: memory?.conversationSummary,
      message,
    });
    const explanation = await deps.explainRecommendation({
      profile: session.profile,
      weather,
      knowledge,
      crops,
      seasonPlan,
      inputSchedule,
      rag,
      memorySummary: compactSummary,
      userMessage: message,
      signal,
    });
    throwIfAborted();
    const agentDuration = clock().getTime() - phaseStarted;
    trace.push(...explanation.trace);
    trace.push(deps.createTraceEntry(
      "agent.finalize",
      { model: deps.openAiMode(), mode: explanation.mode },
      { text: explanation.text, usage: explanation.usage ?? null },
      clock().getTime() - startedAt,
    ));
    await emit("agent.response.completed", "Grounded explanation completed", "completed", {
      mode: explanation.mode,
      toolCalls: explanation.trace.length,
      reasoningSummaryCount: explanation.reasoningSummaries?.length ?? 0,
    }, agentDuration);

    const timings = {
      weatherMs: weatherDuration,
      retrievalMs: retrievalDuration,
      agentMs: agentDuration,
      totalMs: clock().getTime() - startedAt,
    };
    session.lastResult = {
      weather,
      knowledge,
      crops,
      seasonPlan,
      inputSchedule,
      explanation: explanation.text,
      reasoningSummaries: explanation.reasoningSummaries ?? [],
      timings,
      rag,
      trace,
    };
    throwIfAborted();
    await deps.saveSession(session);
    if (signal?.aborted) {
      session.lastResult = previousLastResult;
      await deps.saveSession(session);
      throwIfAborted();
    }

    let savedMemory = memory;
    if (body.memoryId) {
      throwIfAborted();
      savedMemory = await deps.memoryService.savePlan(body.memoryId, {
        profile: session.profile,
        lastResult: session.lastResult,
        conversationSummary: compactSummary,
        memorySessionId: body.memorySessionId,
      }, { signal });
      if (body.memorySessionId) {
        savedMemory = await deps.memoryService.appendConversationTurn(body.memoryId, {
          sessionId: body.memorySessionId,
          messages: [{ role: "agent", text: explanation.text }],
          conversationSummary: compactSummary,
        });
      }
      await emit("memory.saved", "Farm memory updated", "completed", {
        profileFields: Object.keys(session.profile),
        hasPlan: true,
      });
    }

    const result = {
      sessionId,
      profile: session.profile,
      memoryConnected: Boolean(body.memoryId),
      assistant: explanation.text,
      reasoningSummaries: explanation.reasoningSummaries ?? [],
      memory: savedMemory,
      ...session.lastResult,
    };
    await emit("request.completed", "Plan ready", "completed", {
      topCrop: crops[0].name,
      scheduleItems: inputSchedule.length,
      totalDurationMs: timings.totalMs,
    });
    return result;
  };
}
