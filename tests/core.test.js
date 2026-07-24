import test from "node:test";
import assert from "node:assert/strict";

import {
  buildSeasonPlan,
  calculateFinancials,
  createTraceEntry,
  getMissingFields,
  rankCrops,
  retrieveKnowledge,
} from "../server/core.js";

test("asks only for farm fields that are still missing", () => {
  const missing = getMissingFields({
    location: "Gazipur",
    farmSizeAcres: 1,
    soilType: "loam",
    waterAvailability: "irrigated",
  });

  assert.deepEqual(missing, ["budgetBdt", "targetSeason"]);
});

test("crop ranking changes when returned rainfall changes", () => {
  const profile = {
    farmSizeAcres: 1,
    soilType: "loam",
    waterAvailability: "limited",
    budgetBdt: 80000,
    targetSeason: "Rabi",
  };

  const dry = rankCrops(profile, { meanTemperatureC: 23, precipitationMm: 5 });
  const wet = rankCrops(profile, { meanTemperatureC: 23, precipitationMm: 90 });

  assert.equal(dry.length, 4);
  assert.equal(wet.length, 4);
  assert.notEqual(dry[0].id, wet[0].id);
  assert.ok(dry.every((crop) => crop.weatherEvidence.precipitationMm === 5));
  assert.ok(wet.every((crop) => crop.weatherEvidence.precipitationMm === 90));
});

test("crop ranking exposes and uses RAG suitability evidence", () => {
  const profile = {
    farmSizeAcres: 1,
    soilType: "loam",
    waterAvailability: "irrigated",
    budgetBdt: 100000,
    targetSeason: "Rabi",
  };
  const evidenceByCrop = {
    mustard: { suitabilityScore: 95, sources: [{ id: "barc-mustard", publisher: "BARC" }] },
    potato: { suitabilityScore: 10, sources: [{ id: "barc-potato", publisher: "BARC" }] },
  };

  const crops = rankCrops(profile, { meanTemperatureC: 22, precipitationMm: 25 }, evidenceByCrop);
  const mustard = crops.find((crop) => crop.id === "mustard");
  const potato = crops.find((crop) => crop.id === "potato");

  assert.equal(mustard.scoreComponents.ragSuitability, 95);
  assert.equal(potato.scoreComponents.ragSuitability, 10);
  assert.ok(mustard.suitability > potato.suitability);
  assert.equal(mustard.sources[0].id, "barc-mustard");
});

test("every ranked crop explains its inputs, evidence, penalties, and assumption boundary", () => {
  const profile = {
    location: "Gazipur",
    farmSizeAcres: 2.5,
    soilType: "loam",
    waterAvailability: "limited",
    budgetBdt: 50000,
    targetSeason: "Rabi",
  };
  const weather = { meanTemperatureC: 22, precipitationMm: 25 };
  const evidenceByCrop = {
    mustard: { suitabilityScore: 95, sources: [{ id: "barc-mustard" }] },
    potato: { suitabilityScore: 10, sources: [{ id: "barc-potato" }] },
  };

  const crops = rankCrops(profile, weather, evidenceByCrop);

  assert.equal(crops.length, 4);
  assert.deepEqual(
    crops.map(({ id, suitability, roughProfitBdt }) => ({ id, suitability, roughProfitBdt })),
    [
      { id: "mustard", suitability: 86, roughProfitBdt: 75000 },
      { id: "maize", suitability: 65, roughProfitBdt: 87500 },
      { id: "potato", suitability: 54, roughProfitBdt: 275000 },
      { id: "boro-rice", suitability: 25, roughProfitBdt: 30000 },
    ],
  );
  for (const crop of crops) {
    assert.deepEqual(crop.rationale.profileSnapshot, profile);
    assert.deepEqual(crop.rationale.liveWeather, weather);
    assert.equal(crop.rationale.rag.suitabilityScore, crop.scoreComponents.ragSuitability);
    assert.deepEqual(crop.rationale.rag.sourceIds, crop.sources.map((source) => source.id));
    assert.equal(crop.rationale.penalties.waterPenalty, crop.scoreComponents.waterPenalty);
    assert.equal(crop.rationale.penalties.budgetPenalty, crop.scoreComponents.budgetPenalty);
    assert.match(crop.rationale.assumptionBoundary, /^TEAM_ASSUMPTION:/);
    assert.match(crop.rationale.assumptionBoundary, /duration.*yield.*price.*base cost.*financial cost shares/i);
  }
});

test("financial projection scales every value with farm size", () => {
  const oneAcre = calculateFinancials({
    farmSizeAcres: 1,
    yieldPerAcreKg: 2000,
    pricePerKgBdt: 35,
    costsPerAcre: { seed: 5000, fertilizer: 10000, irrigation: 5000, labor: 10000 },
  });
  const twoAcres = calculateFinancials({
    farmSizeAcres: 2,
    yieldPerAcreKg: 2000,
    pricePerKgBdt: 35,
    costsPerAcre: { seed: 5000, fertilizer: 10000, irrigation: 5000, labor: 10000 },
  });

  assert.equal(twoAcres.totalCostBdt, oneAcre.totalCostBdt * 2);
  assert.equal(twoAcres.revenueBdt, oneAcre.revenueBdt * 2);
  assert.equal(twoAcres.netProfitBdt, oneAcre.netProfitBdt * 2);
  assert.equal(twoAcres.roiPercent, oneAcre.roiPercent);
  assert.equal(oneAcre.breakEvenYieldKg, oneAcre.totalCostBdt / 35);
});

test("season plan contains every required checkpoint from land preparation to harvest", () => {
  const plan = buildSeasonPlan("mustard", "2026-11-01");
  const stages = plan.map((item) => item.stage);

  assert.deepEqual(stages, [
    "land_preparation",
    "sowing",
    "fertilizer",
    "irrigation",
    "weed_pest",
    "harvest",
  ]);
  assert.ok(plan.every((item) => /^202\d-\d{2}-\d{2}$/.test(item.date)));
});

test("season plan labels retrieved evidence and team assumptions", () => {
  const plan = buildSeasonPlan("mustard", "2026-11-01", {
    calendar: [{ id: "calendar-1", publisher: "BAMIS", text: "Mustard Rabi calendar" }],
    fertilizer: [{ id: "fert-1", publisher: "BARC", text: "Elemental nutrient guidance" }],
    irrigation: [],
    pest: [{ id: "pest-1", publisher: "BAMIS", text: "Inspect for stem rot" }],
  });

  assert.equal(plan.find((item) => item.stage === "fertilizer").evidence[0].id, "fert-1");
  assert.equal(plan.find((item) => item.stage === "weed_pest").evidence[0].id, "pest-1");
  assert.equal(plan.find((item) => item.stage === "irrigation").truthLabel, "TEAM_ASSUMPTION");
  assert.ok(plan.every((item) => item.truthLabel));
});

test("retrieval returns public-source citations rather than model recall", () => {
  const results = retrieveKnowledge("mustard fertilizer loam", 2);

  assert.equal(results.length, 2);
  assert.ok(results.every((item) => item.sourceUrl.startsWith("https://")));
  assert.ok(results[0].score >= results[1].score);
});

test("trace records tool parameters, raw result, timestamp, and duration", () => {
  const entry = createTraceEntry("weather.getForecast", { location: "Gazipur" }, { precipitationMm: 12 }, 48);

  assert.equal(entry.tool, "weather.getForecast");
  assert.deepEqual(entry.parameters, { location: "Gazipur" });
  assert.deepEqual(entry.result, { precipitationMm: 12 });
  assert.equal(entry.durationMs, 48);
  assert.ok(!Number.isNaN(Date.parse(entry.timestamp)));
});
