import test from "node:test";
import assert from "node:assert/strict";

import { buildInputSchedule } from "../server/scheduler.js";

const profile = {
  farmSizeAcres: 2,
  soilType: "loam",
  budgetBdt: 150000,
};

const crop = {
  id: "maize",
  name: "Maize",
  financials: {
    costBreakdownBdt: {
      fertilizer: 28600,
      irrigation: 19800,
    },
  },
};

const seasonPlan = [
  {
    stage: "fertilizer",
    date: "2026-07-28",
    truthLabel: "RETRIEVED_EVIDENCE",
    evidence: [{
      id: "frg-maize-1",
      publisher: "BARC",
      url: "https://apps.barc.gov.bd/frg",
      text: "For this maize reference, apply urea 45 kg per acre after local soil verification.",
    }],
  },
  {
    stage: "irrigation",
    date: "2026-07-26",
    truthLabel: "RETRIEVED_EVIDENCE",
    evidence: [{
      id: "irrigation-maize-1",
      publisher: "BAMIS",
      url: "https://www.bamis.gov.bd/",
      text: "Check field moisture and forecast rainfall before irrigation.",
    }],
  },
];

function weather(precipitation) {
  return {
    source: "Open-Meteo",
    sourceUrl: "https://api.open-meteo.com/v1/forecast",
    daily: {
      time: ["2026-07-26", "2026-07-27", "2026-07-28"],
      precipitation_sum: [precipitation, 1, 0],
    },
  };
}

test("builds a grounded fertilizer and irrigation schedule with scaled quantities and costs", () => {
  const schedule = buildInputSchedule({
    crop,
    profile,
    weather: weather(0),
    seasonPlan,
  });

  assert.equal(schedule.length, 2);
  assert.deepEqual(schedule[0], {
    id: "fertilizer",
    operation: "Fertilizer",
    growthStage: "fertilizer",
    originalDate: "2026-07-28",
    adjustedDate: "2026-07-28",
    quantity: 90,
    unit: "kg",
    estimatedCostBdt: 28600,
    costTruthLabel: "TEAM_ASSUMPTION",
    adviceTruthLabel: "RETRIEVED_EVIDENCE",
    status: "REQUIRES_FARMER_CONFIRMATION",
    quantityReason: null,
    autoAdjusted: false,
    adjustmentReason: null,
    organicAlternative: null,
    evidence: seasonPlan[0].evidence,
  });
  assert.equal(schedule[1].estimatedCostBdt, 19800);
  assert.equal(schedule[1].status, "READY");
});

test("delays irrigation by four days when forecast rain conflicts with the scheduled date", () => {
  const schedule = buildInputSchedule({
    crop,
    profile,
    weather: weather(18),
    seasonPlan,
  });
  const irrigation = schedule.find((item) => item.id === "irrigation");

  assert.equal(irrigation.originalDate, "2026-07-26");
  assert.equal(irrigation.adjustedDate, "2026-07-30");
  assert.equal(irrigation.autoAdjusted, true);
  assert.match(irrigation.adjustmentReason, /18 mm/);
  assert.match(irrigation.adjustmentReason, /Open-Meteo/);
});

test("does not invent fertilizer quantities when retrieved evidence has no dose", () => {
  const noDose = structuredClone(seasonPlan);
  noDose[0].evidence[0].text = "Apply fertilizer only after a local soil test.";

  const schedule = buildInputSchedule({
    crop,
    profile,
    weather: weather(0),
    seasonPlan: noDose,
  });

  assert.equal(schedule[0].quantity, null);
  assert.equal(schedule[0].unit, null);
  assert.equal(schedule[0].status, "REQUIRES_FARMER_CONFIRMATION");
  assert.match(schedule[0].quantityReason, /not shown/i);
});

test("never creates pesticide or automatic fertilizer actions", () => {
  const schedule = buildInputSchedule({
    crop,
    profile,
    weather: weather(25),
    seasonPlan: [
      ...seasonPlan,
      {
        stage: "weed_pest",
        date: "2026-08-10",
        evidence: [{ text: "Use pesticide X." }],
      },
    ],
  });

  assert.equal(schedule.some((item) => /pest|chemical|pesticide/i.test(item.operation)), false);
  assert.equal(schedule.find((item) => item.id === "fertilizer").status, "REQUIRES_FARMER_CONFIRMATION");
});

test("respects an explicit farmer preference to disable automatic irrigation changes", () => {
  const schedule = buildInputSchedule({
    crop,
    profile,
    weather: weather(25),
    seasonPlan,
    preferences: { autoAdjustIrrigation: false },
  });
  const irrigation = schedule.find((item) => item.id === "irrigation");

  assert.equal(irrigation.autoAdjusted, false);
  assert.equal(irrigation.adjustedDate, irrigation.originalDate);
});
