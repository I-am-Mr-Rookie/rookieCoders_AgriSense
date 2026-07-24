const RAIN_DELAY_THRESHOLD_MM = 10;
const RAIN_DELAY_DAYS = 4;

function addDays(dateString, days) {
  const date = new Date(`${dateString}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function findPerAcreDose(evidence = [], farmSizeAcres) {
  for (const item of evidence) {
    const match = String(item.text || "").match(/\b(\d+(?:\.\d+)?)\s*kg\s*(?:\/|per\s+)acre\b/i);
    if (match) return Number(match[1]) * farmSizeAcres;
  }
  return null;
}

function rainfallOn(weather, date) {
  const index = weather?.daily?.time?.indexOf(date) ?? -1;
  if (index < 0) return null;
  const value = weather.daily.precipitation_sum?.[index];
  return Number.isFinite(value) ? value : null;
}

function scheduleItem({
  id,
  label,
  checkpoint,
  estimatedCostBdt,
  quantity = null,
  unit = null,
  quantityReason = null,
  status,
}) {
  return {
    id,
    operation: label,
    growthStage: checkpoint.stage,
    originalDate: checkpoint.date,
    adjustedDate: checkpoint.date,
    quantity,
    unit,
    quantityReason,
    estimatedCostBdt,
    costTruthLabel: "TEAM_ASSUMPTION",
    adviceTruthLabel: checkpoint.truthLabel ?? "TEAM_ASSUMPTION",
    status,
    autoAdjusted: false,
    adjustmentReason: null,
    organicAlternative: null,
    evidence: checkpoint.evidence ?? [],
  };
}

export function buildInputSchedule({ crop, profile, weather, seasonPlan, preferences = {} }) {
  const fertilizer = seasonPlan.find((item) => item.stage === "fertilizer");
  const irrigation = seasonPlan.find((item) => item.stage === "irrigation");
  const result = [];

  if (fertilizer) {
    const quantity = findPerAcreDose(fertilizer.evidence, profile.farmSizeAcres);
    result.push(scheduleItem({
      id: "fertilizer",
      label: "Fertilizer",
      checkpoint: fertilizer,
      estimatedCostBdt: crop.financials.costBreakdownBdt.fertilizer,
      quantity,
      unit: quantity === null ? null : "kg",
      quantityReason: quantity === null
        ? "Not shown because retrieved evidence does not provide a supported per-acre dose."
        : null,
      status: "REQUIRES_FARMER_CONFIRMATION",
    }));
  }

  if (irrigation) {
    const item = scheduleItem({
      id: "irrigation",
      label: "Irrigation",
      checkpoint: irrigation,
      estimatedCostBdt: crop.financials.costBreakdownBdt.irrigation,
      status: "READY",
    });
    const rainfallMm = rainfallOn(weather, item.originalDate);
    if (preferences.autoAdjustIrrigation !== false && rainfallMm !== null && rainfallMm >= RAIN_DELAY_THRESHOLD_MM) {
      item.adjustedDate = addDays(item.originalDate, RAIN_DELAY_DAYS);
      item.autoAdjusted = true;
      item.adjustmentReason = `${weather.source} forecasts ${rainfallMm} mm rain on ${item.originalDate}; irrigation moved ${RAIN_DELAY_DAYS} days to avoid unnecessary watering.`;
    }
    result.push(item);
  }

  return result;
}
