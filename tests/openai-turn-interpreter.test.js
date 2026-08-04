import test from "node:test";
import assert from "node:assert/strict";

import { interpretFarmerTurn } from "../server/openai.js";

test("LLM turn interpreter understands natural updates and crop-plan transitions", async () => {
  let request;
  const fakeClient = {
    responses: {
      create: async (value) => {
        request = value;
        return {
          output_text: JSON.stringify({
            intent: "request_crop_plan",
            profilePatch: {
              location: null,
              farmSizeAcres: null,
              soilType: null,
              waterAvailability: null,
              budgetBdt: 100000,
              targetSeason: null,
            },
            requestedCropId: "maize",
            pendingField: null,
            assistant: "I have updated the budget to BDT 100,000 and will create a fresh maize plan.",
          }),
        };
      },
    },
  };

  const result = await interpretFarmerTurn(
    "Last time it was 50k. Now use 100k and make a new maize plan.",
    { location: "Pabna", budgetBdt: 50000, targetSeason: "Rabi" },
    { previousPlan: { selectedCropId: "mustard" }, responseLanguage: "English" },
    undefined,
    fakeClient,
  );

  assert.equal(result.kind, "request_plan");
  assert.equal(result.selectedCropId, "maize");
  assert.deepEqual(result.patch, { budgetBdt: 100000 });
  assert.match(request.input[0].content, /newer explicit facts override older memory/i);
  assert.match(request.input[0].content, /Role stack:/i);
  assert.match(request.input[0].content, /Primary role: Bangladesh farmer conversation/i);
  assert.match(request.input[0].content, /do not require exact phrases/i);
  assert.match(request.input[0].content, /another supported crop plan/i);
  assert.equal(request.text.format.type, "json_schema");
});
