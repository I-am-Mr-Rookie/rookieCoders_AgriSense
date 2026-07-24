import OpenAI from "openai";

const model = process.env.OPENAI_MODEL || "gpt-5.6-sol";
const effort = process.env.OPENAI_REASONING_EFFORT || "high";

function client() {
  return process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
}

function parseJson(text) {
  return JSON.parse(text.replace(/^```json\s*/i, "").replace(/```$/i, "").trim());
}

export async function extractProfilePatch(message, currentProfile) {
  const openai = client();
  if (!openai) return {};
  const response = await openai.responses.create({
    model,
    reasoning: { effort },
    input: [
      {
        role: "system",
        content: "Extract only explicitly supplied Bangladesh farm facts. Return strict JSON with any of: location, farmSizeAcres, soilType, waterAvailability, budgetBdt, targetSeason. Never guess. Numeric values must be numbers.",
      },
      { role: "user", content: JSON.stringify({ currentProfile, message }) },
    ],
  });
  return parseJson(response.output_text);
}

export async function explainRecommendation(context) {
  const openai = client();
  if (!openai) {
    const best = context.crops[0];
    return `${best.name} ranks first because its ${best.suitability}% suitability uses the farm profile, ${context.weather.precipitationMm.toFixed(1)} mm forecast rainfall, and ${context.weather.meanTemperatureC.toFixed(1)} C mean temperature. Financial values come from the deterministic calculator.`;
  }
  const response = await openai.responses.create({
    model,
    reasoning: { effort },
    text: { verbosity: "low" },
    input: [
      {
        role: "system",
        content: "You are AgriSense. Explain the ranked crops and first recommendation concisely for a Bangladeshi farmer. Use only supplied farm, weather, retrieval, plan and finance evidence. State uncertainty. Never recalculate or invent numbers.",
      },
      { role: "user", content: JSON.stringify(context) },
    ],
  });
  return response.output_text;
}

export function openAiMode() {
  return process.env.OPENAI_API_KEY ? `${model}/${effort}` : "deterministic-fallback";
}
