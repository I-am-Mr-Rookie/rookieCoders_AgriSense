const ALLOWED_FIELDS = new Set([
  "location",
  "farmSizeAcres",
  "soilType",
  "waterAvailability",
  "budgetBdt",
  "targetSeason",
]);

const SOIL_TYPES = new Set(["loam", "sandy loam", "clay loam", "clay", "sandy"]);
const WATER_AVAILABILITY = new Set(["irrigated", "limited", "rainfed"]);
const NON_BANGLADESH_COUNTRY = /\b(?:india|pakistan|usa|united states|uk|united kingdom)\b/i;

export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ValidationError";
  }
}

function normalizeNumber(value, field, maximum) {
  let normalized;
  try {
    normalized = Number(value);
  } catch {
    throw new ValidationError(`${field} must be a finite number.`);
  }
  if (!Number.isFinite(normalized) || normalized <= 0 || normalized > maximum) {
    throw new ValidationError(`${field} must be greater than 0 and at most ${maximum}.`);
  }
  return normalized;
}

function normalizeChoice(value, field, supportedValues) {
  if (typeof value !== "string") {
    throw new ValidationError(`${field} must be one of: ${[...supportedValues].join(", ")}.`);
  }
  const normalized = value.trim().toLowerCase();
  if (!supportedValues.has(normalized)) {
    throw new ValidationError(`${field} must be one of: ${[...supportedValues].join(", ")}.`);
  }
  return normalized;
}

export function validateProfilePatch(patch) {
  if (patch === null || typeof patch !== "object" || Array.isArray(patch)) {
    throw new ValidationError("Profile patch must be an object.");
  }

  const unknownFields = Object.keys(patch).filter((field) => !ALLOWED_FIELDS.has(field));
  if (unknownFields.length) {
    throw new ValidationError(`Unknown profile field: ${unknownFields.join(", ")}.`);
  }

  const normalized = {};

  if (Object.hasOwn(patch, "location")) {
    if (typeof patch.location !== "string" || !patch.location.trim()) {
      throw new ValidationError("location must be a non-empty Bangladesh location.");
    }
    const location = patch.location.trim();
    if (NON_BANGLADESH_COUNTRY.test(location)) {
      throw new ValidationError("location must be in Bangladesh.");
    }
    normalized.location = location;
  }

  if (Object.hasOwn(patch, "farmSizeAcres")) {
    normalized.farmSizeAcres = normalizeNumber(patch.farmSizeAcres, "farmSizeAcres", 100);
  }

  if (Object.hasOwn(patch, "soilType")) {
    normalized.soilType = normalizeChoice(patch.soilType, "soilType", SOIL_TYPES);
  }

  if (Object.hasOwn(patch, "waterAvailability")) {
    normalized.waterAvailability = normalizeChoice(
      patch.waterAvailability,
      "waterAvailability",
      WATER_AVAILABILITY,
    );
  }

  if (Object.hasOwn(patch, "budgetBdt")) {
    normalized.budgetBdt = normalizeNumber(patch.budgetBdt, "budgetBdt", 100000000);
  }

  if (Object.hasOwn(patch, "targetSeason")) {
    if (typeof patch.targetSeason !== "string" || patch.targetSeason.trim().toLowerCase() !== "rabi") {
      throw new ValidationError("targetSeason must be Rabi.");
    }
    normalized.targetSeason = "Rabi";
  }

  return normalized;
}

export function publicFailure(errorId) {
  return {
    error: "AgriSense could not complete this step. Your saved farm details are safe; please retry.",
    errorId,
    phase: "Tier-0",
    recoverable: true,
  };
}
