import test from "node:test";
import assert from "node:assert/strict";

import { extractProfilePatch } from "../server/openai.js";

test("profile extraction delegates mixed farmer language to a strict model schema", async () => {
  let request;
  const fakeClient = {
    responses: {
      create: async (value) => {
        request = value;
        return {
          output_text: JSON.stringify({
            location: null,
            farmSizeAcres: 10,
            soilType: "clay loam",
            waterAvailability: "irrigated",
            budgetBdt: 50000,
            targetSeason: null,
          }),
        };
      },
    },
  };

  const patch = await extractProfilePatch(
    "10 acres, clay, enough water source, 50k, this month",
    { location: "Pabna" },
    undefined,
    fakeClient,
  );

  assert.deepEqual(patch, {
    farmSizeAcres: 10,
    soilType: "clay loam",
    waterAvailability: "irrigated",
    budgetBdt: 50000,
  });
  assert.equal(request.text.format.type, "json_schema");
  assert.equal(request.text.format.strict, true);
  assert.deepEqual(request.text.format.schema.properties.targetSeason.enum, ["Rabi", null]);
  assert.match(request.input[0].content, /Bangla, English, Banglish/i);
  assert.match(request.input[0].content, /this month.+must remain null/i);
  assert.match(request.input[0].content, /clay.+clay loam/i);
  assert.match(request.input[0].content, /50k.+50000/i);
});

test("profile extraction handles Banglish rural units without inventing missing facts", async () => {
  const fakeClient = {
    responses: {
      create: async () => ({
        output_text: JSON.stringify({
          location: "Barishal",
          farmSizeAcres: 0.3306,
          soilType: null,
          waterAvailability: null,
          budgetBdt: 5000,
          targetSeason: null,
        }),
      }),
    },
  };

  const patch = await extractProfilePatch(
    "amar 1 bigha jomi ase borishal e amar budget 5000 tk",
    {},
    undefined,
    fakeClient,
  );

  assert.deepEqual(patch, {
    location: "Barishal",
    farmSizeAcres: 0.3306,
    budgetBdt: 5000,
  });
});
