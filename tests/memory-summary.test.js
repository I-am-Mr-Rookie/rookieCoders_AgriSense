import test from "node:test";
import assert from "node:assert/strict";

import { buildCompactMemorySummary } from "../server/memory-summary.js";

test("builds a bounded canonical farm memory from authoritative profile fields", () => {
  const summary = buildCompactMemorySummary({
    profile: {
      location: "Gazipur",
      farmSizeAcres: 1,
      soilType: "loam",
      waterAvailability: "irrigated",
      budgetBdt: 40000,
      targetSeason: "Rabi",
    },
    message: "Please remember that I prefer low-risk plans and want to conserve water.",
  });

  assert.equal(
    summary,
    "Location=Gazipur | Area=1ac | Soil=loam | Water=irrigated | Budget=BDT40000 | Season=Rabi | Preferences=low risk, conserve water",
  );
  assert.equal(summary.length <= 600, true);
});

test("keeps useful preferences while excluding chatter, recovery IDs, and tool traces", () => {
  const recoveryId = `farm_${"a".repeat(24)}`;
  const summary = buildCompactMemorySummary({
    profile: { location: "Cumilla", budgetBdt: 60000 },
    previousSummary: "Location=Dhaka | Preferences=budget conscious",
    message: `Thanks. ${recoveryId}. tool call fetch_weather returned 17 records. I prefer organic methods.`,
  });

  assert.match(summary, /^Location=Cumilla \| Budget=BDT60000/);
  assert.match(summary, /Preferences=budget conscious, organic preference/);
  assert.doesNotMatch(summary, /farm_|fetch_weather|17 records|Thanks/i);
});

test("replaces contradicted preference without copying full conversation text", () => {
  const summary = buildCompactMemorySummary({
    profile: { location: "Gazipur" },
    previousSummary: "Location=Gazipur | Preferences=low cost",
    message: "Quality matters more now; I no longer prefer low cost. Use low-risk options.",
  });

  assert.equal(summary, "Location=Gazipur | Preferences=low risk");
});
