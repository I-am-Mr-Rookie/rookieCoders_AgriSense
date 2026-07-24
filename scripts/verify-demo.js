import fs from "node:fs";
import { buildSeasonPlan, rankCrops } from "../server/core.js";
import { loadCorpus, createLexicalRetriever } from "../server/rag.js";
import { getWeather } from "../server/weather.js";

const started = Date.now();
const profile = { location: "Gazipur", farmSizeAcres: 1, soilType: "loam", waterAvailability: "irrigated", budgetBdt: 90000, targetSeason: "Rabi" };
const weather = await getWeather(profile.location);
const records = await loadCorpus();
const retrieve = createLexicalRetriever(records);
const queries = {
  mustard: "mustard suitability soil fertilizer irrigation calendar yield economics",
  potato: "potato suitability soil fertilizer irrigation crop calendar yield economics",
  maize: "rabi maize suitability soil fertilizer irrigation crop calendar yield economics",
  "boro-rice": "boro rice suitability soil fertilizer irrigation crop calendar yield economics",
};
const evidenceByCrop = Object.fromEntries(Object.entries(queries).map(([crop, query]) => [crop, retrieve(query, { crop, season: "Rabi", location: "Gazipur" }, 8)]));
const crops = rankCrops(profile, weather, evidenceByCrop);
const selected = crops[0];
const seasonPlan = buildSeasonPlan(selected.id, "2026-11-01");
const f = selected.financials;
const financeReconciles = f.revenueBdt === Math.round(f.expectedYieldKg * f.pricePerKgBdt)
  && f.netProfitBdt === f.revenueBdt - f.totalCostBdt
  && f.roiPercent === Math.round((f.netProfitBdt / f.totalCostBdt) * 10000) / 100
  && f.breakEvenYieldKg === f.totalCostBdt / f.pricePerKgBdt;
const output = {
  generatedAt: new Date().toISOString(),
  durationMs: Date.now() - started,
  request: { profilePatch: profile, startDate: "2026-11-01" },
  weather,
  rankedCrops: crops.map(({ id, name, suitability, riskLevel, evidenceScore, evidenceChunkIds, financials }) => ({ id, name, suitability, riskLevel, evidenceScore, evidenceChunkIds, financials })),
  selectedCropId: selected.id,
  seasonPlan,
  financeReconciles,
  representativeCitations: Object.fromEntries(Object.entries(evidenceByCrop).map(([crop, rows]) => [crop, rows.slice(0, 3).map((row) => ({ record_id: row.record_id, publisher: row.publisher, source_title: row.source_title, source_url: row.source_url, source_page_or_table: row.source_page_or_table, retrieval_score: row.retrieval_score, confidence: row.confidence, quality_flags: row.quality_flags }))])),
  retrieval: { mode: "in-process-lexical", corpusCount: records.length, semantic: false, filters: { country: "Bangladesh", season: "Rabi", location: "Gazipur", corpusLanes: ["core", "bd_expansion"] } },
};
fs.writeFileSync(new URL("../docs/gazipur-demo-evidence.json", import.meta.url), `${JSON.stringify(output, null, 2)}\n`);
console.log(JSON.stringify({ generatedAt: output.generatedAt, durationMs: output.durationMs, weather: { retrievedAt: weather.retrievedAt, location: weather.location, precipitationMm: weather.precipitationMm, meanTemperatureC: weather.meanTemperatureC }, selectedCropId: selected.id, cropOrder: crops.map((crop) => crop.id), financeReconciles, corpusCount: records.length, chunkIds: Object.fromEntries(Object.entries(evidenceByCrop).map(([crop, rows]) => [crop, rows.slice(0, 3).map((row) => row.record_id)])) }, null, 2));
