import test from "node:test";
import assert from "node:assert/strict";

import { briefCropCandidates } from "../server/openai.js";

const crops = ["mustard", "maize", "potato", "boro-rice"].map((id, index) => ({
  id,
  name: id,
  suitability: 80 - index,
  riskLevel: "medium",
  waterNeed: "medium",
  costPerAcreBdt: 30000 + index * 10000,
  fullFarmCostBdt: 300000 + index * 100000,
  budgetGapBdt: 250000 + index * 100000,
  budgetRemainingBdt: 0,
  plannedAreaAcres: 1,
  plannedCostBdt: 50000,
  scoreComponents: { ragSuitability: 75 },
  sources: [{ id: `source-${id}` }],
}));

test("model authors four candidate briefs without replacing deterministic fields", async () => {
  let request;
  const fakeClient = { responses: { create: async (value) => {
    request = value;
    return { output_text: JSON.stringify({ candidates: crops.map((crop) => ({
      cropId: crop.id,
      summary: `Why ${crop.name} fits`,
      pros: ["Grounded advantage"],
      cons: ["Grounded limitation"],
    })) }) };
  } } };

  const result = await briefCropCandidates({
    profile: { location: "Pabna", farmSizeAcres: 10, budgetBdt: 50000 },
    weather: { precipitationMm: 46, meanTemperatureC: 28 },
    crops,
    responseLanguage: "English",
  }, fakeClient);

  assert.equal(result.length, 4);
  assert.equal(result[0].fullFarmCostBdt, crops[0].fullFarmCostBdt);
  assert.equal(result[0].summary, "Why mustard fits");
  assert.equal(request.text.format.name, "crop_candidate_briefs");
  assert.equal(request.text.format.schema.properties.candidates.minItems, 4);
  assert.match(request.input[0].content, /must not recalculate/i);
});
