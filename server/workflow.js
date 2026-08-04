import { createActivityEmitter } from "./activity.js";
import { buildCompactMemorySummary } from "./memory-summary.js";
import { isDirectAssistanceRequest } from "./intents.js";
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
    let memoryMissing = false;
    if (body.memoryId) {
      memory = await deps.memoryService.load(body.memoryId);
      if (!memory) {
        memoryMissing = true;
      } else {
        // Memory seeds a new session, but facts already established in the
        // active session are newer and must not be overwritten by stale memory.
        session.profile = { ...memory.profile, ...session.profile };
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
    }

    const message = redactRecoveryIds(body.message);
    const preferences = {
      autoAdjustIrrigation: typeof body.preferences?.autoAdjustIrrigation === "boolean"
        ? body.preferences.autoAdjustIrrigation
        : memory?.preferences?.autoAdjustIrrigation !== false,
    };
    const recoverMissingMemory = async () => {
      if (!body.memoryId || !memoryMissing) return memory;
      memory = await deps.memoryService.ensure(body.memoryId, {
        profile: session.profile,
        lastResult: session.lastResult,
        preferences,
        conversationSummary: "",
        sessions: body.memorySessionId
          ? [{
              id: String(body.memorySessionId),
              title: "Recovered conversation",
              messages: [],
              lastResult: session.lastResult,
              summary: "",
            }]
          : [],
      });
      memoryMissing = false;
      return memory;
    };
    if (isChatTurn) {
      const currentPlan = session.lastResult ?? memory?.lastResult ?? null;
      const turnContext = {
        pendingField: body.pendingField,
        awaitingField: body.awaitingField === true,
        responseLanguage: body.responseLanguage,
        previousPlan: currentPlan,
      };
      const usesLlmTurnInterpreter = typeof deps.interpretFarmerTurn === "function";
      const turn = usesLlmTurnInterpreter
        ? await deps.interpretFarmerTurn(message, session.profile, turnContext, signal)
        : deps.interpretConversationTurn(message, session.profile, turnContext);
      let patch = {};
      if (turn.kind === "revision_staged" || turn.kind === "request_plan") {
        patch = deps.validateProfilePatch(turn.patch);
      } else if (turn.kind === "general") {
        patch = usesLlmTurnInterpreter
          ? deps.validateProfilePatch(turn.patch ?? {})
          : isDirectAssistanceRequest(message)
          ? {}
          : deps.validateProfilePatch(
              body.profilePatch ?? await deps.extractProfilePatch(message, session.profile, signal),
            );
      }
      throwIfAborted();

      if (Object.keys(patch).length) {
        session.profile = { ...session.profile, ...patch };
        await deps.saveSession(session);
      }
      await recoverMissingMemory();

      const missingFields = deps.getMissingFields(session.profile);
      const changedFields = Object.keys(patch);
      const planRequested = turn.kind === "request_plan";
      const readyToPlan = (changedFields.length > 0 || planRequested) && missingFields.length === 0;
      const planStale = readyToPlan && Boolean(currentPlan);
      const generalAssistance = turn.kind === "general" && changedFields.length === 0 && !turn.assistant
        ? await deps.answerGeneralFarmerQuestion({
            message,
            currentProfile: session.profile,
            responseLanguage: body.responseLanguage,
            signal,
          })
        : "";
      throwIfAborted();
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

      const kind = generalAssistance
        ? "general_assistance"
        : turn.kind === "general" && changedFields.length
          ? readyToPlan ? "revision_staged" : "intake_updated"
          : turn.kind;
      const wantsBangla = /Bangla|Bengali/i.test(String(body.responseLanguage || ""));
      const assistant = turn.assistant || generalAssistance || (
        wantsBangla
          ? missingFields.length
            ? `আরও দরকার: ${missingFields.map((field) => ({
                location: "বাংলাদেশের জেলা",
                farmSizeAcres: "জমির আয়তন",
                soilType: "মাটির ধরন",
                waterAvailability: "পানির ব্যবস্থা",
                budgetBdt: "বাজেট",
                targetSeason: "মৌসুম",
              }[field] ?? field)).join(", ")}।`
            : changedFields.length
              ? "খামারের তথ্য প্রস্তুত। দেখে নিয়ে পরিকল্পনা তৈরি করুন।"
              : "বাজেট, জমির আয়তন, মাটি, পানি, জায়গা বা মৌসুম বদলাতে সাহায্য করতে পারি।"
          : missingFields.length
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
        missingFields: generalAssistance ? [] : missingFields,
        readyToPlan,
        planStale,
        planRequest: planRequested && missingFields.length === 0
          ? {
              action: turn.selectedCropId ? "plan" : "analyze",
              ...(turn.selectedCropId ? { selectedCropId: turn.selectedCropId } : {}),
            }
          : null,
        memory: savedMemory,
      };
    }

    const patch = deps.validateProfilePatch(
      body.profilePatch ?? (
        body.action === "plan" || body.action === "analyze"
          ? {}
          : await deps.extractProfilePatch(message, session.profile, signal)
      ),
    );
    throwIfAborted();
    session.profile = { ...session.profile, ...patch };
    await deps.saveSession(session);
    await recoverMissingMemory();
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

    const rag = {
      ...deps.loadCorpus().report,
      retrieval: "in-process structured lexical retrieval",
      embeddingMode: "not used",
    };
    const compactSummary = buildCompactMemorySummary({
      profile: session.profile,
      previousSummary: memory?.conversationSummary,
      message,
    });

    if (body.action === "analyze") {
      phaseStarted = clock().getTime();
      await emit("agent.response.started", "AgriSense is comparing four grounded crop options", "running", {
        model: deps.openAiMode(),
      });
      const candidates = await deps.briefCropCandidates({
        profile: session.profile,
        weather,
        crops,
        knowledge,
        responseLanguage: body.responseLanguage,
        signal,
      });
      throwIfAborted();
      const agentDuration = clock().getTime() - phaseStarted;
      const bangla = /Bangla|Bengali/i.test(String(body.responseLanguage || ""));
      const answer = bangla
        ? "আপনার তথ্য ও বাজেট দেখে চারটি ফসল বাছাই করেছি। একটি ফসল নির্বাচন করুন; তারপরই তার পূর্ণ পরিকল্পনা তৈরি হবে।"
        : "I compared four grounded crop options against your farm and budget. Choose one crop; only then will AgriSense create its full plan.";
      trace.push(deps.createTraceEntry(
        "agent.candidate_briefs",
        { model: deps.openAiMode(), candidateIds: candidates.map((crop) => crop.id) },
        { candidateCount: candidates.length },
        agentDuration,
      ));
      await emit("agent.response.completed", "Four crop choices are ready", "completed", {
        candidateCount: candidates.length,
      }, agentDuration);
      const timings = {
        weatherMs: weatherDuration,
        retrievalMs: retrievalDuration,
        agentMs: agentDuration,
        totalMs: clock().getTime() - startedAt,
      };
      session.lastResult = {
        candidateSelectionRequired: true,
        candidates,
        weather,
        knowledge,
        rag,
        trace,
        timings,
        explanation: answer,
      };
      await deps.saveSession(session);
      let savedMemory = memory;
      if (body.memoryId) {
        savedMemory = await deps.memoryService.savePlan(body.memoryId, {
          profile: session.profile,
          lastResult: session.lastResult,
          conversationSummary: compactSummary,
          memorySessionId: body.memorySessionId,
        }, { signal });
        if (body.memorySessionId) {
          savedMemory = await deps.memoryService.appendConversationTurn(body.memoryId, {
            sessionId: body.memorySessionId,
            messages: [{ role: "agent", text: answer }],
            conversationSummary: compactSummary,
          });
        }
        await emit("memory.saved", "Crop choices saved to farm memory", "completed", {
          profileFields: Object.keys(session.profile),
          candidateCount: candidates.length,
        });
      }
      await emit("request.completed", "Choose one crop to continue", "completed", {
        candidateCount: candidates.length,
        totalDurationMs: timings.totalMs,
      });
      return {
        sessionId,
        profile: session.profile,
        memoryConnected: Boolean(body.memoryId),
        assistant: answer,
        memory: savedMemory,
        ...session.lastResult,
      };
    }

    const selectedCrop = body.selectedCropId
      ? crops.find((crop) => crop.id === String(body.selectedCropId))
      : crops[0];
    if (!selectedCrop) throw new Error("Select one of the four available crops.");
    const plannedAreaAcres = selectedCrop.plannedAreaAcres ?? session.profile.farmSizeAcres;
    const plannedFinancials = selectedCrop.plannedFinancials ?? selectedCrop.financials;
    const plannedProfile = {
      ...session.profile,
      farmSizeAcres: plannedAreaAcres,
      originalFarmSizeAcres: session.profile.farmSizeAcres,
      plannedAreaAcres,
    };
    const planCrop = {
      ...selectedCrop,
      financials: plannedFinancials,
      roughProfitBdt: plannedFinancials?.netProfitBdt ?? selectedCrop.roughProfitBdt,
    };
    const startDate = body.startDate || "2026-11-01";
    const planEvidence = deps.getPlanEvidence(selectedCrop.id, session.profile);
    const seasonPlan = deps.buildSeasonPlan(selectedCrop.id, startDate, planEvidence);
    trace.push(deps.createTraceEntry(
      "season.build",
      { cropId: selectedCrop.id, startDate, plannedAreaAcres },
      seasonPlan,
      0,
    ));
    const inputSchedule = deps.buildInputSchedule({
      crop: planCrop,
      profile: plannedProfile,
      weather,
      seasonPlan,
      preferences,
    });
    trace.push(deps.createTraceEntry(
      "scheduler.build",
      { cropId: selectedCrop.id, startDate, plannedAreaAcres },
      inputSchedule,
      0,
    ));
    await emit("scheduler.completed", "Input schedule prepared", "completed", {
      scheduleItems: inputSchedule.length,
      automaticAdjustments: inputSchedule.filter((item) => item.autoAdjusted).length,
      confirmationRequired: inputSchedule.filter((item) => item.status === "REQUIRES_FARMER_CONFIRMATION").length,
    }, 0);

    phaseStarted = clock().getTime();
    await emit("agent.response.started", "AgriSense is checking tools and explaining the plan", "running", {
      model: deps.openAiMode(),
    });
    const explanation = await deps.explainRecommendation({
      profile: plannedProfile,
      weather,
      knowledge,
      crops: [planCrop],
      seasonPlan,
      inputSchedule,
      rag,
      memorySummary: compactSummary,
      userMessage: message,
      responseLanguage: body.responseLanguage,
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
      crops: [planCrop],
      candidates: previousLastResult?.candidates ?? crops,
      candidateSelectionRequired: false,
      candidateCrops: crops,
      selectedCropId: selectedCrop.id,
      plannedAreaAcres,
      originalFarmSizeAcres: session.profile.farmSizeAcres,
      budgetBdt: session.profile.budgetBdt,
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
          messages: [
            ...(message ? [{ role: "farmer", text: message }] : []),
            { role: "agent", text: explanation.text },
          ],
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
      topCrop: selectedCrop.name,
      scheduleItems: inputSchedule.length,
      totalDurationMs: timings.totalMs,
    });
    return result;
  };
}
