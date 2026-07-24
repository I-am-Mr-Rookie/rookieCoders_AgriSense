import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";

import { buildSeasonPlan, createTraceEntry, getMissingFields, rankCrops } from "./core.js";
import { databaseStatus, getDatabasePool, initializeDatabase, loadSession, saveSession } from "./db.js";
import { explainRecommendation, extractProfilePatch, openAiMode } from "./openai.js";
import { getRagStatus, retrieveEvidence } from "./rag.js";
import { getWeather } from "./weather.js";

const app = express();
const port = Number(process.env.PORT || 3001);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dist = path.resolve(__dirname, "../dist");
const pool = getDatabasePool();

function deploymentSha() {
  if (process.env.DEPLOYMENT_SHA) return process.env.DEPLOYMENT_SHA;
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { cwd: path.resolve(__dirname, ".."), encoding: "utf8", timeout: 1000 }).trim();
  } catch {
    return "unreported";
  }
}

app.use(express.json({ limit: "64kb" }));

app.get("/api/health", async (_req, res) => {
  const [database, retrieval] = await Promise.all([databaseStatus(), getRagStatus(pool)]);
  res.json({
    ok: true,
    phase: "T0-RAG",
    deploymentSha: deploymentSha(),
    database,
    retrieval,
    model: openAiMode(),
    weather: "Open-Meteo/live-on-request",
  });
});

app.get("/api/session/:sessionId", async (req, res) => {
  const session = await loadSession(String(req.params.sessionId));
  res.json({ sessionId: session.id, profile: session.profile, lastResult: session.lastResult, persisted: Boolean(session.lastResult) });
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
  const sessionId = String(req.body.sessionId || crypto.randomUUID());
  try {
    const session = await loadSession(sessionId);
    const patch = req.body.profilePatch ?? await extractProfilePatch(String(req.body.message || ""), session.profile);
    session.profile = { ...session.profile, ...patch };
    const missingFields = getMissingFields(session.profile);
    if (missingFields.length) {
      await saveSession(session);
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
    const cropQueries = [
      ["mustard", "mustard suitability soil fertilizer irrigation calendar yield economics"],
      ["potato", "potato suitability soil fertilizer irrigation crop calendar yield economics"],
      ["maize", "rabi maize suitability soil fertilizer irrigation crop calendar yield economics"],
      ["boro-rice", "boro rice suitability soil fertilizer irrigation crop calendar yield economics"],
    ];
    const retrievals = await Promise.all(cropQueries.map(async ([cropId, query]) => {
      const filters = {
        country: "Bangladesh",
        season: session.profile.targetSeason,
        crop: cropId,
        location: session.profile.location,
        corpusLanes: ["core", "bd_expansion"],
      };
      return [cropId, query, filters, await retrieveEvidence({ query, filters, limit: 8, pool })];
    }));
    const evidenceByCrop = Object.fromEntries(retrievals.map(([cropId, , , result]) => [cropId, result.rows]));
    const knowledge = [...new Map(retrievals.flatMap(([, , , result]) => result.rows).map((row) => [row.record_id, row])).values()].slice(0, 20);
    for (const [cropId, query, filters, result] of retrievals) {
      trace.push(createTraceEntry("knowledge.retrieve", { query, filters, limit: 8 }, {
        cropId,
        mode: result.mode,
        fallbackReason: result.fallbackReason,
        matches: result.rows.map((row) => ({
          record_id: row.record_id,
          retrieval_score: row.retrieval_score,
          publisher: row.publisher,
          source_title: row.source_title,
          source_url: row.source_url,
          source_page_or_table: row.source_page_or_table,
          confidence: row.confidence,
          quality_flags: row.quality_flags,
        })),
      }, Date.now() - retrievalStarted));
    }

    const crops = rankCrops(session.profile, weather, evidenceByCrop);
    trace.push(createTraceEntry("crops.rank", { profile: session.profile, weather: { precipitationMm: weather.precipitationMm, meanTemperatureC: weather.meanTemperatureC }, evidenceChunkIds: Object.fromEntries(Object.entries(evidenceByCrop).map(([cropId, rows]) => [cropId, rows.map((row) => row.record_id)])) }, crops.map(({ id, suitability, roughProfitBdt, evidenceScore }) => ({ id, suitability, roughProfitBdt, evidenceScore })), 0));

    const selectedCrop = crops.find((crop) => crop.id === req.body.selectedCropId) ?? crops[0];
    const startDate = req.body.startDate || "2026-11-01";
    const seasonPlan = buildSeasonPlan(selectedCrop.id, startDate);
    trace.push(createTraceEntry("season.build", { cropId: selectedCrop.id, startDate }, seasonPlan, 0));

    const explanation = await explainRecommendation({ profile: session.profile, weather, knowledge, crops, seasonPlan });
    trace.push(createTraceEntry("agent.explain", { model: openAiMode() }, { explanation }, Date.now() - started));

    session.lastResult = { weather, knowledge, crops, selectedCropId: selectedCrop.id, seasonPlan, explanation, trace };
    await saveSession(session);
    res.json({ sessionId, profile: session.profile, assistant: explanation, ...session.lastResult });
  } catch (error) {
    res.status(502).json({ error: error.message, phase: "T0-RAG", recoverable: true, retry: true });
  }
});

app.use(express.static(dist));
app.get("*path", (_req, res) => res.sendFile(path.join(dist, "index.html")));

initializeDatabase()
  .then((mode) => app.listen(port, () => console.log(`AgriSense T0-RAG listening on :${port} (${mode})`)))
  .catch((error) => {
    console.error("Database initialization failed", error);
    process.exitCode = 1;
  });
