import test from "node:test";
import assert from "node:assert/strict";

import { createDiseaseDiagnosisService } from "../server/disease-diagnosis.js";
import { Tier2UnavailableError } from "../server/market-intelligence.js";

const imageRequest = {
  imageDataUrl: "data:image/png;base64,aGVsbG8=",
  crop: "Tomato",
  note: "Brown leaf spots",
};

test("sends a validated high-detail vision request and normalizes the diagnosis", async () => {
  let captured;
  const service = createDiseaseDiagnosisService({
    client: {
      responses: {
        async create(payload) {
          captured = payload;
          return {
            output_text: JSON.stringify({
              summary: "The leaf shows lesions consistent with a possible fungal problem.",
              likelyCauses: [
                { name: "Early blight", confidence: "medium" },
                { name: "Unknown", confidence: "certain" },
              ],
              observations: ["Brown concentric lesions", "Yellow tissue"],
              safeNextSteps: ["Isolate the affected plant", "Ask a local extension officer"],
              chemicalRecommendation: "Apply anything",
              limitations: ["A photograph cannot confirm the pathogen."],
            }),
          };
        },
      },
    },
    model: "gpt-5.6",
  });

  const result = await service.diagnose(imageRequest);

  assert.equal(captured.model, "gpt-5.6");
  assert.equal(captured.reasoning.effort, "medium");
  const content = captured.input[0].content;
  assert.equal(content[0].type, "input_text");
  assert.match(content[0].text, /never recommend a chemical/i);
  assert.deepEqual(content[1], {
    type: "input_image",
    image_url: imageRequest.imageDataUrl,
    detail: "high",
  });
  assert.equal(captured.text.format.type, "json_schema");
  assert.equal(captured.text.format.strict, true);
  assert.deepEqual(result.likelyCauses, [
    { name: "Early blight", confidence: "medium" },
    { name: "Unknown", confidence: "low" },
  ]);
  assert.equal(result.chemicalRecommendation, null);
  assert.equal(result.kind, "disease_diagnosis");
  assert.equal(result.model, "gpt-5.6");
});

test("bounds untrusted diagnosis fields and preserves uncertainty", async () => {
  const service = createDiseaseDiagnosisService({
    client: {
      responses: {
        async create() {
          return {
            output_text: "```json\n" + JSON.stringify({
              summary: "",
              likelyCauses: [],
              observations: Array.from({ length: 20 }, (_, index) => `Observation ${index}`),
              safeNextSteps: [],
              limitations: [],
            }) + "\n```",
          };
        },
      },
    },
  });

  const result = await service.diagnose(imageRequest);

  assert.match(result.summary, /could not identify a reliable visible pattern/i);
  assert.equal(result.observations.length, 8);
  assert.match(result.limitations[0], /image-only assessment/i);
  assert.equal(result.chemicalRecommendation, null);
});

test("fails recoverably when vision is not configured", async () => {
  const service = createDiseaseDiagnosisService({ client: null });

  await assert.rejects(
    service.diagnose(imageRequest),
    (error) => error instanceof Tier2UnavailableError && error.statusCode === 503,
  );
});
