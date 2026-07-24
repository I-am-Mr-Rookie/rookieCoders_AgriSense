import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";

import { assistantText } from "../shared/assistant.js";
import { createNdjsonWriter } from "./activity.js";
import { buildSeasonPlan, createTraceEntry, getMissingFields, rankCrops } from "./core.js";
import { interpretConversationTurn } from "./conversation.js";
import { databaseMode, deleteSession, initializeDatabase, loadSession, saveSession } from "./db.js";
import { createMemoryService } from "./memory.js";
import { explainRecommendation, extractProfilePatch, openAiMode } from "./openai.js";
import { createHttpErrorHandler } from "./http.js";
import { getCropEvidence, getPlanEvidence, loadCorpus, retrieveFacts } from "./rag.js";
import { createPersistenceGuard, summarizeError } from "./recovery.js";
import { getReleaseRevision } from "./revision.js";
import { buildInputSchedule } from "./scheduler.js";
import { ValidationError, validateProfilePatch } from "./validation.js";
import { getWeather } from "./weather.js";
import { createPlanningWorkflow } from "./workflow.js";

const app = express();
const port = Number(process.env.PORT || 3001);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dist = path.resolve(__dirname, "../dist");
const memoryService = createMemoryService({ loadSession, saveSession, deleteSession });

app.use(express.json({ limit: "64kb" }));

app.get("/api/health", (_req, res) => {
  const corpus = loadCorpus().report;
  res.json({
    ok: true,
    phase: "Tier-1",
    releaseRevision: getReleaseRevision(),
    database: databaseMode(),
    model: openAiMode(),
    capabilities: {
      persistentMemory: true,
      inputScheduler: true,
      activityStream: true,
      externalNotifications: false,
    },
    rag: corpus,
  });
});

app.get(["/evaluation", "/evaluation.html"], (_req, res) => {
  res.sendFile(path.resolve(__dirname, "../evaluation.html"));
});

function workflowFor(persistence) {
  return createPlanningWorkflow({
    loadSession,
    saveSession: (session) => persistence.saveMergedProfile(session),
    extractProfilePatch,
    interpretConversationTurn,
    validateProfilePatch,
    getMissingFields,
    getWeather,
    getCropEvidence,
    retrieveFacts,
    rankCrops,
    getPlanEvidence,
    buildSeasonPlan,
    buildInputSchedule,
    loadCorpus,
    createTraceEntry,
    explainRecommendation,
    openAiMode,
    memoryService,
    createSessionId: () => crypto.randomUUID(),
  });
}

app.post("/api/memory/create", async (req, res) => {
  try {
    const sessionId = String(req.body?.sessionId || "");
    const session = sessionId ? await loadSession(sessionId) : { profile: {}, lastResult: null };
    const created = await memoryService.create({
      profile: session.profile,
      lastResult: session.lastResult,
      preferences: {
        autoAdjustIrrigation: req.body?.preferences?.autoAdjustIrrigation !== false,
      },
    });
    res.status(201).json({ ...created, database: databaseMode() });
  } catch (error) {
    const errorId = crypto.randomUUID();
    console.error(`AgriSense memory creation failed (${errorId})`, summarizeError(error));
    res.status(502).json({ error: "Could not create farmer memory.", errorId, recoverable: true });
  }
});

app.post("/api/memory/resume", async (req, res) => {
  try {
    const memory = await memoryService.load(req.body.memoryId);
    if (!memory) return res.status(404).json({ error: "Farmer memory was not found.", recoverable: true });
    return res.json({ memory, database: databaseMode() });
  } catch (error) {
    return res.status(400).json({ error: error.message, recoverable: true });
  }
});

app.post("/api/memory/reset", async (req, res) => {
  try {
    const reset = await memoryService.reset(req.body.memoryId);
    return res.json({ reset });
  } catch (error) {
    return res.status(400).json({ error: error.message, recoverable: true });
  }
});

app.post("/api/memory/preferences", async (req, res) => {
  try {
    const memory = await memoryService.updatePreferences(req.body.memoryId, req.body.preferences);
    if (!memory) return res.status(404).json({ error: "Farmer memory was not found.", recoverable: true });
    return res.json({ memory, database: databaseMode() });
  } catch (error) {
    return res.status(400).json({ error: error.message, recoverable: true });
  }
});

app.post("/api/memory/sessions", async (req, res) => {
  try {
    const memory = await memoryService.createConversationSession(
      req.body.memoryId,
      req.body.session,
    );
    return res.status(201).json({ memory, database: databaseMode() });
  } catch (error) {
    return res.status(400).json({ error: error.message, recoverable: true });
  }
});

app.post("/api/session/message", async (req, res) => {
  const persistence = createPersistenceGuard(saveSession);
  try {
    const result = await workflowFor(persistence)(req.body);
    return res.json({ ...result, assistant: assistantText(result.assistant) });
  } catch (error) {
    if (error instanceof ValidationError) {
      return res.status(400).json({ error: error.message, phase: "Tier-0", recoverable: true });
    }
    const errorId = crypto.randomUUID();
    console.error(`AgriSense Tier-1 request failed (${errorId})`, summarizeError(error));
    return res.status(502).json(persistence.failurePayload(errorId));
  }
});

app.post("/api/session/message/stream", async (req, res) => {
  const persistence = createPersistenceGuard(saveSession);
  const write = createNdjsonWriter(res);
  const controller = new AbortController();
  res.on("close", () => {
    if (!res.writableEnded) controller.abort();
  });
  try {
    const result = await workflowFor(persistence)(req.body, write, controller.signal);
    write({ type: "result", status: "completed", data: { ...result, assistant: assistantText(result.assistant) } });
  } catch (error) {
    if (controller.signal.aborted) return;
    const errorId = crypto.randomUUID();
    const payload = error instanceof ValidationError
      ? { error: error.message, phase: "Tier-0", recoverable: true }
      : persistence.failurePayload(errorId);
    if (!(error instanceof ValidationError)) {
      console.error(`AgriSense Tier-1 stream failed (${errorId})`, summarizeError(error));
    }
    write({
      id: "activity-error",
      type: "request.failed",
      label: "Request failed",
      status: "failed",
      timestamp: new Date().toISOString(),
      details: payload,
    });
  } finally {
    if (!res.destroyed) res.end();
  }
});

app.use(createHttpErrorHandler());

app.use(express.static(dist));
app.get("*path", (_req, res) => res.sendFile(path.join(dist, "index.html")));

initializeDatabase()
  .then((mode) => app.listen(port, () => console.log(`AgriSense Tier-1 listening on :${port} (${mode})`)))
  .catch((error) => {
    console.error("Database initialization failed", summarizeError(error));
    process.exitCode = 1;
  });
