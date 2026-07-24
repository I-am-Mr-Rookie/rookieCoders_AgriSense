import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";

import { buildSeasonPlan, createTraceEntry, getMissingFields, rankCrops, retrieveKnowledge } from "./core.js";
import { databaseMode, initializeDatabase, loadSession, saveSession } from "./db.js";
import { explainRecommendation, extractProfilePatch, openAiMode } from "./openai.js";
import { getWeather } from "./weather.js";

const app = express();
const port = Number(process.env.PORT || 3001);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dist = path.resolve(__dirname, "../dist");

app.use(express.json({ limit: "64kb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, phase: "T0-Initial", database: databaseMode(), model: openAiMode() });
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
    const knowledge = retrieveKnowledge(`${session.profile.targetSeason} ${session.profile.soilType} fertilizer irrigation Bangladesh`, 3);
    trace.push(createTraceEntry("knowledge.retrieve", { query: `${session.profile.targetSeason} ${session.profile.soilType}`, limit: 3 }, knowledge, Date.now() - retrievalStarted));

    const crops = rankCrops(session.profile, weather);
    trace.push(createTraceEntry("crops.rank", { profile: session.profile, weather: { precipitationMm: weather.precipitationMm, meanTemperatureC: weather.meanTemperatureC } }, crops.map(({ id, suitability, roughProfitBdt }) => ({ id, suitability, roughProfitBdt })), 0));

    const startDate = req.body.startDate || "2026-11-01";
    const seasonPlan = buildSeasonPlan(crops[0].id, startDate);
    trace.push(createTraceEntry("season.build", { cropId: crops[0].id, startDate }, seasonPlan, 0));

    const explanation = await explainRecommendation({ profile: session.profile, weather, knowledge, crops, seasonPlan });
    trace.push(createTraceEntry("agent.explain", { model: openAiMode() }, { explanation }, Date.now() - started));

    session.lastResult = { weather, knowledge, crops, seasonPlan, explanation, trace };
    await saveSession(session);
    res.json({ sessionId, profile: session.profile, assistant: explanation, ...session.lastResult });
  } catch (error) {
    res.status(502).json({ error: error.message, phase: "T0-Initial", recoverable: true });
  }
});

app.use(express.static(dist));
app.get("*path", (_req, res) => res.sendFile(path.join(dist, "index.html")));

initializeDatabase()
  .then((mode) => app.listen(port, () => console.log(`AgriSense T0-Initial listening on :${port} (${mode})`)))
  .catch((error) => {
    console.error("Database initialization failed", error);
    process.exitCode = 1;
  });
