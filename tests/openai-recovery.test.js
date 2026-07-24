import test from "node:test";
import assert from "node:assert/strict";

import { explainRecommendation } from "../server/openai.js";

const context = {
  profile: {
    location: "Gazipur",
    farmSizeAcres: 2.5,
    soilType: "loam",
    waterAvailability: "limited",
    budgetBdt: 50000,
    targetSeason: "Rabi",
  },
  weather: { precipitationMm: 25, meanTemperatureC: 22 },
  rag: { report: { totalIndexed: 1976 } },
  knowledge: [],
  seasonPlan: [],
  crops: [
    {
      id: "mustard",
      name: "Mustard",
      suitability: 86,
      riskLevel: "low",
      scoreComponents: {
        ragSuitability: 95,
        waterPenalty: 0,
        budgetPenalty: 15,
      },
      sources: [{ id: "barc-mustard-gazipur" }],
      rationale: {
        profileSnapshot: {
          location: "Gazipur",
          farmSizeAcres: 2.5,
          soilType: "loam",
          waterAvailability: "limited",
          budgetBdt: 50000,
          targetSeason: "Rabi",
        },
        liveWeather: { precipitationMm: 25, meanTemperatureC: 22 },
        rag: { suitabilityScore: 95, sourceIds: ["barc-mustard-gazipur"] },
        penalties: { waterPenalty: 0, budgetPenalty: 15 },
        assumptionBoundary: "TEAM_ASSUMPTION: duration, yield, price, base cost, and financial cost shares are planning assumptions.",
      },
    },
  ],
};

function assertGroundedRecoveryText(text) {
  assert.match(text, /Gazipur/);
  assert.match(text, /2\.5/);
  assert.match(text, /25/);
  assert.match(text, /22/);
  assert.match(text, /95/);
  assert.match(text, /barc-mustard-gazipur/);
  assert.match(text, /water[^.\n]*0/i);
  assert.match(text, /budget[^.\n]*15/i);
  assert.match(text, /TEAM_ASSUMPTION/);
}

test("no-key explanation uses the deterministic grounded builder", async () => {
  const result = await explainRecommendation(context, null);

  assert.equal(result.mode, "deterministic-explanation");
  assert.equal(result.usage, null);
  assert.deepEqual(result.trace, []);
  assertGroundedRecoveryText(result.text);
});

test("tool-loop failure returns a sanitized deterministic recovery", async () => {
  const leakedSecret = "sk-super-secret-do-not-leak";
  const fakeClient = {
    responses: {
      create: async () => {
        throw new Error(`provider exploded with ${leakedSecret}`);
      },
    },
  };

  const result = await explainRecommendation(context, fakeClient);
  const serialized = JSON.stringify(result);

  assert.equal(result.mode, "deterministic-recovery");
  assert.equal(result.usage, null);
  assert.match(result.text, /DETERMINISTIC_RECOVERY/);
  assertGroundedRecoveryText(result.text);
  assert.equal(result.trace.length, 1);
  assert.equal(result.trace[0].tool, "agent.model_recovery");
  assert.deepEqual(result.trace[0].parameters, {});
  assert.deepEqual(result.trace[0].result, { code: "MODEL_TOOL_LOOP_FAILED" });
  assert.doesNotMatch(serialized, /provider exploded/i);
  assert.doesNotMatch(serialized, /sk-super-secret-do-not-leak/i);
});
