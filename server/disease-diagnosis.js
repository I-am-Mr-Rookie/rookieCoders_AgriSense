import { Tier2UnavailableError } from "./market-intelligence.js";
import { validateDiseaseImage } from "./tier2-validation.js";

const DEFAULT_MODEL = "gpt-5.6";
const CONFIDENCE = new Set(["low", "medium", "high"]);
const MAX_LIST_ITEMS = 8;

const diagnosisSchema = {
  type: "object",
  properties: {
    summary: { type: "string" },
    likelyCauses: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          confidence: { type: "string", enum: ["low", "medium", "high"] },
        },
        required: ["name", "confidence"],
        additionalProperties: false,
      },
    },
    observations: { type: "array", items: { type: "string" } },
    safeNextSteps: { type: "array", items: { type: "string" } },
    limitations: { type: "array", items: { type: "string" } },
    chemicalRecommendation: { type: "null" },
  },
  required: [
    "summary",
    "likelyCauses",
    "observations",
    "safeNextSteps",
    "limitations",
    "chemicalRecommendation",
  ],
  additionalProperties: false,
};

function parseDiagnosis(text) {
  const cleaned = String(text || "")
    .replace(/^```json\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  return JSON.parse(cleaned);
}

function boundedText(value, maximum = 1200) {
  return typeof value === "string"
    ? value.trim().replace(/\s+/g, " ").slice(0, maximum)
    : "";
}

function textList(values, maximum = MAX_LIST_ITEMS) {
  if (!Array.isArray(values)) return [];
  return values
    .map((value) => boundedText(value, 300))
    .filter(Boolean)
    .slice(0, maximum);
}

function normalizeDiagnosis(value, model) {
  const likelyCauses = Array.isArray(value?.likelyCauses)
    ? value.likelyCauses
      .map((item) => ({
        name: boundedText(item?.name, 120),
        confidence: CONFIDENCE.has(item?.confidence) ? item.confidence : "low",
      }))
      .filter((item) => item.name)
      .slice(0, 5)
    : [];
  const limitations = textList(value?.limitations);
  if (!limitations.length) {
    limitations.push("This is an image-only assessment and cannot confirm a pathogen.");
  }
  return {
    kind: "disease_diagnosis",
    summary: boundedText(value?.summary)
      || "The image could not identify a reliable visible pattern. Try a clearer close-up and a whole-plant photo.",
    likelyCauses,
    observations: textList(value?.observations),
    safeNextSteps: textList(value?.safeNextSteps),
    chemicalRecommendation: null,
    limitations,
    model,
  };
}

function diagnosisPrompt({ crop, note, responseLanguage }) {
  return [
    "Assess this Bangladesh farm image as cautious visual decision support, not a confirmed diagnosis.",
    crop ? `The farmer identifies the crop as ${crop}.` : "The crop is not confirmed.",
    note ? `Farmer note: ${note}.` : "",
    "Describe only visible observations. Give up to five likely causes with low, medium, or high confidence.",
    "Suggest safe non-chemical next steps such as isolation, better photos, monitoring, sanitation, or consulting an agricultural extension officer.",
    "Never recommend a chemical, pesticide, fungicide, brand, dose, or application schedule because no current official registry evidence is attached.",
    "State image-quality and look-alike limitations explicitly.",
    responseLanguage ? `Write every farmer-facing field in ${responseLanguage}.` : "",
  ].filter(Boolean).join(" ");
}

export function createDiseaseDiagnosisService({
  client,
  model = DEFAULT_MODEL,
} = {}) {
  return {
    async diagnose(rawRequest, { signal } = {}) {
      if (!client?.responses?.create) throw new Tier2UnavailableError();
      const request = validateDiseaseImage(rawRequest);
      const response = await client.responses.create({
        model,
        reasoning: { effort: "medium" },
        input: [{
          role: "user",
          content: [
            { type: "input_text", text: diagnosisPrompt(request) },
            { type: "input_image", image_url: request.imageDataUrl, detail: "high" },
          ],
        }],
        text: {
          format: {
            type: "json_schema",
            name: "agrisense_disease_assessment",
            strict: true,
            schema: diagnosisSchema,
          },
        },
      }, signal ? { signal } : undefined);
      return normalizeDiagnosis(parseDiagnosis(response?.output_text), model);
    },
  };
}
