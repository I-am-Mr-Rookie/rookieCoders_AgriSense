const FIELD_CONFIG = {
  budgetBdt: {
    aliases: [/\bbudget\b/i, /\bcost limit\b/i],
    question: "What should your new total season budget be?",
  },
  farmSizeAcres: {
    aliases: [/\bfarm size\b/i, /\bacres?\b/i, /\bland size\b/i],
    question: "What is the updated farm size in acres?",
  },
  soilType: {
    aliases: [/\bsoil\b/i],
    question: "What soil type should I use: loam, sandy loam, or clay loam?",
  },
  waterAvailability: {
    aliases: [/\bwater\b/i, /\birrigat(?:ed|ion)\b/i, /\brain[ -]?fed\b/i],
    question: "What water availability should I use: irrigated, rainfed, or limited?",
  },
  location: {
    aliases: [/\blocation\b/i, /\bdistrict\b/i],
    question: "Which Bangladesh district should I use for the farm?",
  },
  targetSeason: {
    aliases: [/\bseason\b/i],
    question: "Which target season should I use? Tier 1 currently supports Rabi.",
  },
};

const EDIT_INTENT = /\b(change|update|edit|modify|set|make|adjust|revise|different)\b|\bi now have\b|\bmy .+ is now\b/i;
const MONEY_FORMAT = new Intl.NumberFormat("en-BD", { maximumFractionDigits: 0 });

function emptyResult(kind, assistant = "", pendingField = "") {
  return { kind, assistant, pendingField, patch: {}, changedFields: [] };
}

function detectField(message) {
  return Object.entries(FIELD_CONFIG).find(([, config]) =>
    config.aliases.some((pattern) => pattern.test(message))
  )?.[0] ?? "";
}

function numericValue(message) {
  const match = String(message).match(/(?:bdt|tk\.?|taka)?\s*([0-9][0-9,]*(?:\.[0-9]+)?)/i);
  return match ? Number(match[1].replaceAll(",", "")) : null;
}

function parseFieldValue(field, message) {
  const text = String(message).trim();
  const lower = text.toLowerCase();

  if (field === "budgetBdt") {
    const value = numericValue(text);
    if (value === null) return { missing: true };
    if (!Number.isFinite(value) || value <= 0 || value > 100_000_000) {
      return { invalid: "Please enter a total season budget greater than BDT 0 and no more than BDT 100,000,000." };
    }
    return { value };
  }

  if (field === "farmSizeAcres") {
    const value = numericValue(text);
    if (value === null) return { missing: true };
    if (!Number.isFinite(value) || value <= 0 || value > 1_000_000) {
      return { invalid: "Please enter a farm size greater than 0 acres." };
    }
    return { value };
  }

  if (field === "soilType") {
    const value = ["sandy loam", "clay loam", "loam"].find((option) => lower.includes(option));
    return value ? { value } : { missing: true };
  }

  if (field === "waterAvailability") {
    if (/\blimited\b/.test(lower)) return { value: "limited" };
    if (/\brain[ -]?fed\b/.test(lower)) return { value: "rainfed" };
    if (/\birrigat(?:ed|ion)\b/.test(lower)) return { value: "irrigated" };
    return { missing: true };
  }

  if (field === "targetSeason") {
    if (/\brabi\b/i.test(text)) return { value: "Rabi" };
    return { missing: true };
  }

  if (field === "location") {
    const match = text.match(/\b(?:to|in|district(?:\s+is)?)\s+([A-Za-z][A-Za-z .'-]{1,60})[.!?]?$/i);
    if (!match) return { missing: true };
    return { value: match[1].trim().replace(/[.!?]+$/, "") };
  }

  return { missing: true };
}

function formatValue(field, value) {
  if (field === "budgetBdt") return `BDT ${MONEY_FORMAT.format(value)}`;
  if (field === "farmSizeAcres") return `${value} acres`;
  return String(value);
}

function fieldLabel(field) {
  return {
    budgetBdt: "Budget",
    farmSizeAcres: "Farm size",
    soilType: "Soil",
    waterAvailability: "Water availability",
    location: "Location",
    targetSeason: "Season",
  }[field];
}

export function interpretConversationTurn(message, currentProfile = {}, context = {}) {
  const text = String(message || "").trim();
  const detectedField = detectField(text);
  const pendingField = Object.hasOwn(FIELD_CONFIG, context.pendingField)
    ? context.pendingField
    : "";
  const selectedField = pendingField || detectedField;
  const revisionSignal = EDIT_INTENT.test(text) || Boolean(pendingField) || context.awaitingField === true;

  if (!selectedField) {
    if (revisionSignal) {
      return emptyResult(
        "clarify_field",
        "What would you like to change: budget, farm size, soil, water availability, location, or season?",
      );
    }
    return emptyResult("general");
  }

  if (!revisionSignal && !context.awaitingField) return emptyResult("general");

  const parsed = parseFieldValue(selectedField, text);
  if (parsed.invalid) return emptyResult("invalid_value", parsed.invalid, selectedField);
  if (parsed.missing) {
    return emptyResult("clarify_value", FIELD_CONFIG[selectedField].question, selectedField);
  }

  const previous = currentProfile[selectedField];
  if (previous === parsed.value) {
    return emptyResult(
      "unchanged",
      `${fieldLabel(selectedField)} is already ${formatValue(selectedField, parsed.value)}. Tell me another detail to change, or create the plan when you are ready.`,
    );
  }

  return {
    kind: "revision_staged",
    assistant: `${fieldLabel(selectedField)} updated from ${formatValue(selectedField, previous)} to ${formatValue(selectedField, parsed.value)}. Your previous recommendation will stay visible until you create the updated plan.`,
    pendingField: "",
    patch: { [selectedField]: parsed.value },
    changedFields: [selectedField],
  };
}
