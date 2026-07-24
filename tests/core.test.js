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
