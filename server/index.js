import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";

import { assistantText } from "../shared/assistant.js";
import { buildSeasonPlan, createTraceEntry, getMissingFields, rankCrops } from "./core.js";
import { databaseMode, initializeDatabase, loadSession, saveSession } from "./db.js";
import { explainRecommendation, extractProfilePatch, openAiMode } from "./openai.js";
import { getCropEvidence, getPlanEvidence, loadCorpus, retrieveFacts } from "./rag.js";
import { createPersistenceGuard, summarizeError } from "./recovery.js";
import { getReleaseRevision } from "./revision.js";
import { ValidationError, validateProfilePatch } from "./validation.js";
import { getWeather } from "./weather.js";

const app = express();
const port = Number(process.env.PORT || 3001);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dist = path.resolve(__dirname, "../dist");

app.use(express.json({ limit: "64kb" }));

app.get("/api/health", (_req, res) => {
  const corpus = loadCorpus().report;
  res.json({
    ok: true,
    phase: "Tier-0",
    releaseRevision: getReleaseRevision(),
    database: databaseMode(),
    model: openAiMode(),
    rag: corpus,
  });
});

app.get(["/evaluation", "/evaluation.html"], (_req, res) => {
  res.sendFile(path.resolve(__dirname, "../evaluation.html"));
});

const FIELD_LABELS = {
  location: "location in Bangladesh",
  farmSizeAcres: "farm size in acres",
  soilType: "soil type",
  waterAvailability: "water availability",
  budgetBdt: "budget in BDT",
  targetSeason: "target season",
};

app.post("/api/session/message", async (req, res) => {
  const started = Date.now();
  const persistence = createPersistenceGuard(saveSession);
  try {
    const sessionId = String(req.body.sessionId || crypto.randomUUID());
    const session = await loadSession(sessionId);
    const patch = validateProfilePatch(
      req.body.profilePatch ?? await extractProfilePatch(String(req.body.message || ""), session.profile),
    );
    session.profile = { ...session.profile, ...patch };
    await persistence.saveMergedProfile(session);
    const missingFields = getMissingFields(session.profile);
    if (missingFields.length) {
      return res.json({
        sessionId,
        profile: session.profile,
        missingFields,
        assistant: `I still need: ${missingFields.map((field) => FIELD_LABELS[field]).join(", ")}.`,
      });
    }

    const trace = [];
    const weatherStarted = Date.now();
    const weather = await getWeather(session.profile.location);
    trace.push(createTraceEntry("weather.getForecast", { location: session.profile.location, days: 7 }, weather, Date.now() - weatherStarted));

    const retrievalStarted = Date.now();
    const cropIds = ["mustard", "potato", "maize", "boro-rice"];
    const evidenceByCrop = Object.fromEntries(cropIds.map((id) => [id, getCropEvidence(session.profile, id)]));
    const knowledge = retrieveFacts(
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
    trace.push(createTraceEntry("rag.retrieve", { query: `${session.profile.targetSeason} ${session.profile.soilType}`, cropCount: cropIds.length, limit: 6 }, { evidenceByCrop, knowledge }, Date.now() - retrievalStarted));

    const crops = rankCrops(session.profile, weather, evidenceByCrop);
    trace.push(createTraceEntry("crops.rank", { profile: session.profile, weather: { precipitationMm: weather.precipitationMm, meanTemperatureC: weather.meanTemperatureC } }, crops.map(({ id, suitability, roughProfitBdt }) => ({ id, suitability, roughProfitBdt })), 0));

    const startDate = req.body.startDate || "2026-11-01";
    const planEvidence = getPlanEvidence(crops[0].id, session.profile);
    const seasonPlan = buildSeasonPlan(crops[0].id, startDate, planEvidence);
    trace.push(createTraceEntry("season.build", { cropId: crops[0].id, startDate }, seasonPlan, 0));

    const rag = { ...loadCorpus().report, retrieval: "in-process structured lexical retrieval", embeddingMode: "not used" };
    const explanation = await explainRecommendation({ profile: session.profile, weather, knowledge, crops, seasonPlan, rag });
    trace.push(...explanation.trace);
    trace.push(createTraceEntry("agent.finalize", { model: openAiMode(), mode: explanation.mode }, { text: explanation.text, usage: explanation.usage ?? null }, Date.now() - started));

    session.lastResult = { weather, knowledge, crops, seasonPlan, explanation: explanation.text, rag, trace };
    await saveSession(session);
    res.json({ sessionId, profile: session.profile, assistant: assistantText(explanation), ...session.lastResult });
  } catch (error) {
    if (error instanceof ValidationError) {
      return res.status(400).json({ error: error.message, phase: "Tier-0", recoverable: true });
    }
    const errorId = crypto.randomUUID();
    console.error(`AgriSense Tier-0 request failed (${errorId})`, summarizeError(error));
    return res.status(502).json(persistence.failurePayload(errorId));
  }
});

app.use(express.static(dist));
app.get("*path", (_req, res) => res.sendFile(path.join(dist, "index.html")));

initializeDatabase()
  .then((mode) => app.listen(port, () => console.log(`AgriSense Tier-0 listening on :${port} (${mode})`)))
  .catch((error) => {
    console.error("Database initialization failed", summarizeError(error));
    process.exitCode = 1;
  });
