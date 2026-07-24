const REQUIRED_FIELDS = [
  "location",
  "farmSizeAcres",
  "soilType",
  "waterAvailability",
  "budgetBdt",
  "targetSeason",
];

const CROPS = [
  { id: "mustard", name: "Mustard", idealRainMm: 20, idealTempC: 22, waterNeed: "low", baseCostBdt: 30000, yieldKg: 800, priceBdt: 75, durationDays: 95 },
  { id: "potato", name: "Potato", idealRainMm: 35, idealTempC: 19, waterNeed: "medium", baseCostBdt: 90000, yieldKg: 8000, priceBdt: 25, durationDays: 105 },
  { id: "maize", name: "Maize", idealRainMm: 50, idealTempC: 24, waterNeed: "medium", baseCostBdt: 55000, yieldKg: 3000, priceBdt: 30, durationDays: 120 },
  { id: "boro-rice", name: "Boro rice", idealRainMm: 90, idealTempC: 26, waterNeed: "high", baseCostBdt: 65000, yieldKg: 2200, priceBdt: 35, durationDays: 145 },
];

const KNOWLEDGE = [
  {
    id: "barc-frg-2024",
    title: "Bangladesh Fertilizer Recommendation Guide 2024",
    text: "Bangladesh crop fertilizer recommendations should be adjusted for crop, soil condition, nutrient status and management context. Mustard fertilizer decisions must remain tied to local soil evidence.",
    sourceUrl: "https://apps.barc.gov.bd/fertilizer_recommendation/FRG%20English%2030.10.2024.pdf",
  },
  {
    id: "brri-knowledge",
    title: "Bangladesh Rice Knowledge Bank",
    text: "Rice cultivation guidance includes variety selection, fertilizer management, irrigation, pest management and crop-stage practices for Bangladesh.",
    sourceUrl: "https://knowledgebank-brri.org/",
  },
  {
    id: "fao-crop-calendar",
    title: "FAO Crop Calendar",
    text: "Crop calendars connect planting and harvest windows with location, crop and season; local dates must be validated before farmer use.",
    sourceUrl: "https://cropcalendar.apps.fao.org/",
  },
  {
    id: "open-meteo-docs",
    title: "Open-Meteo Forecast API",
    text: "Forecast responses expose temperature and precipitation values for geographic coordinates and can use the location timezone.",
    sourceUrl: "https://open-meteo.com/en/docs",
  },
];

export function getMissingFields(profile = {}) {
  return REQUIRED_FIELDS.filter((field) => {
    const value = profile[field];
    return value === undefined || value === null || (typeof value === "string" && value.trim() === "");
  });
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function calculateFinancials({ farmSizeAcres, yieldPerAcreKg, pricePerKgBdt, costsPerAcre }) {
  const costBreakdownBdt = Object.fromEntries(
    Object.entries(costsPerAcre).map(([name, value]) => [name, Math.round(value * farmSizeAcres)]),
  );
  const totalCostBdt = Object.values(costBreakdownBdt).reduce((sum, value) => sum + value, 0);
  const expectedYieldKg = yieldPerAcreKg * farmSizeAcres;
  const revenueBdt = Math.round(expectedYieldKg * pricePerKgBdt);
  const netProfitBdt = revenueBdt - totalCostBdt;

  return {
    costBreakdownBdt,
    totalCostBdt,
    expectedYieldKg,
    pricePerKgBdt,
    revenueBdt,
    netProfitBdt,
    roiPercent: totalCostBdt ? Math.round((netProfitBdt / totalCostBdt) * 10000) / 100 : 0,
    breakEvenYieldKg: totalCostBdt / pricePerKgBdt,
  };
}

export function rankCrops(profile, weather, evidenceByCrop = {}) {
  return CROPS.map((crop) => {
    const rainScore = clamp(40 - Math.abs(weather.precipitationMm - crop.idealRainMm) * 0.55, 0, 40);
    const temperatureScore = clamp(30 - Math.abs(weather.meanTemperatureC - crop.idealTempC) * 3, 0, 30);
    const soilScore = ["loam", "sandy loam", "clay loam"].includes(String(profile.soilType).toLowerCase()) ? 15 : 9;
    const waterPenalty = profile.waterAvailability === "limited" && crop.waterNeed === "high" ? 12 : 0;
    const budgetPenalty = profile.budgetBdt < crop.baseCostBdt * profile.farmSizeAcres ? 15 : 0;
    const baseSuitability = clamp(rainScore + temperatureScore + soilScore + 15 - waterPenalty - budgetPenalty, 0, 100);
    const evidence = evidenceByCrop[crop.id] ?? {};
    const ragSuitability = Number.isFinite(evidence.suitabilityScore) ? evidence.suitabilityScore : null;
    const suitability = Math.round(clamp(
      ragSuitability === null ? baseSuitability : baseSuitability * 0.72 + ragSuitability * 0.28,
      0,
      100,
    ));
    const financials = calculateFinancials({
      farmSizeAcres: profile.farmSizeAcres,
      yieldPerAcreKg: crop.yieldKg,
      pricePerKgBdt: crop.priceBdt,
      costsPerAcre: {
        seed: crop.baseCostBdt * 0.16,
        fertilizer: crop.baseCostBdt * 0.26,
        irrigation: crop.baseCostBdt * 0.18,
        labor: crop.baseCostBdt * 0.4,
      },
    });

    return {
      ...crop,
      suitability,
      riskLevel: suitability >= 75 ? "low" : suitability >= 55 ? "medium" : "high",
      roughProfitBdt: financials.netProfitBdt,
      financials,
      weatherEvidence: {
        precipitationMm: weather.precipitationMm,
        meanTemperatureC: weather.meanTemperatureC,
      },
      scoreComponents: {
        weatherRain: Math.round(rainScore * 10) / 10,
        weatherTemperature: Math.round(temperatureScore * 10) / 10,
        soil: soilScore,
        waterPenalty,
        budgetPenalty,
        baseSuitability: Math.round(baseSuitability * 10) / 10,
        ragSuitability,
      },
      sources: evidence.sources ?? [],
      rationale: {
        profileSnapshot: {
          location: profile.location,
          farmSizeAcres: profile.farmSizeAcres,
          soilType: profile.soilType,
          waterAvailability: profile.waterAvailability,
          budgetBdt: profile.budgetBdt,
          targetSeason: profile.targetSeason,
        },
        liveWeather: {
          precipitationMm: weather.precipitationMm,
          meanTemperatureC: weather.meanTemperatureC,
        },
        rag: {
          suitabilityScore: ragSuitability,
          sourceIds: (evidence.sources ?? []).map((item) => item.id),
        },
        penalties: {
          waterPenalty,
          budgetPenalty,
        },
        assumptionBoundary: "TEAM_ASSUMPTION: duration, yield, price, base cost, and financial cost shares are planning assumptions; live weather and retrieved RAG values are not.",
      },
    };
  }).sort((a, b) => b.suitability - a.suitability || b.roughProfitBdt - a.roughProfitBdt);
}

function addDays(dateString, days) {
  const date = new Date(`${dateString}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function buildSeasonPlan(cropId, startDate, planEvidence = {}) {
  const crop = CROPS.find((item) => item.id === cropId) ?? CROPS[0];
  const stage = (name, days, action, evidence = []) => {
    const first = evidence[0];
    const excerpt = String(first?.text ?? "").replace(/\s+/g, " ").trim().slice(0, 220);
    const groundedAction = excerpt
      ? `${action} Retrieved guidance (${first.publisher || "source"}): ${excerpt}`
      : action;
    return {
    stage: name,
    date: addDays(startDate, days),
    action: groundedAction,
    truthLabel: evidence.length ? "RETRIEVED_EVIDENCE" : "TEAM_ASSUMPTION",
    evidence,
    };
  };
  return [
    stage("land_preparation", 0, "Prepare and level the field; verify drainage."),
    stage("sowing", 7, `Sow ${crop.name} within the selected Rabi window.`, planEvidence.calendar),
    stage("fertilizer", 22, "Use the retrieved nutrient guidance only after a local soil test; do not infer product doses.", planEvidence.fertilizer),
    stage("irrigation", 35, "Irrigate only after comparing field moisture with forecast rainfall.", planEvidence.irrigation),
    stage("weed_pest", 50, "Inspect weeds and pests; record symptoms before treatment. No pesticide is recommended without registry evidence.", planEvidence.pest),
    stage("harvest", crop.durationDays, `Harvest ${crop.name} at crop maturity and record realized yield.`, planEvidence.yield),
  ];
}

function terms(text) {
  return new Set(String(text).toLowerCase().match(/[a-z0-9]+/g) ?? []);
}

export function retrieveKnowledge(query, limit = 3) {
  const queryTerms = terms(query);
  return KNOWLEDGE.map((item) => {
    const documentTerms = terms(`${item.title} ${item.text}`);
    const score = [...queryTerms].reduce((sum, term) => sum + (documentTerms.has(term) ? 1 : 0), 0);
    return { ...item, score };
  }).sort((a, b) => b.score - a.score || a.title.localeCompare(b.title)).slice(0, limit);
}

export function createTraceEntry(tool, parameters, result, durationMs) {
  return { tool, parameters, result, timestamp: new Date().toISOString(), durationMs };
}

export function getCrop(cropId) {
  return CROPS.find((crop) => crop.id === cropId) ?? CROPS[0];
}
