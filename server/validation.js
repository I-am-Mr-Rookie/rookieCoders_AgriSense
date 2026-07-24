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
const BANGLADESH_DISTRICTS = new Set([
  "bagerhat",
  "bandarban",
  "barguna",
  "barishal",
  "bhola",
  "bogura",
  "brahmanbaria",
  "chandpur",
  "chapainawabganj",
  "chattogram",
  "chuadanga",
  "cox's bazar",
  "cumilla",
  "dhaka",
  "dinajpur",
  "faridpur",
  "feni",
  "gaibandha",
  "gazipur",
  "gopalganj",
  "habiganj",
  "jamalpur",
  "jashore",
  "jhalokati",
  "jhenaidah",
  "joypurhat",
  "khagrachhari",
  "khulna",
  "kishoreganj",
  "kurigram",
  "kushtia",
  "lakshmipur",
  "lalmonirhat",
  "madaripur",
  "magura",
  "manikganj",
  "meherpur",
  "moulvibazar",
  "munshiganj",
  "mymensingh",
  "naogaon",
  "narail",
  "narayanganj",
  "narsingdi",
  "natore",
  "netrokona",
  "nilphamari",
  "noakhali",
  "pabna",
  "panchagarh",
  "patuakhali",
  "pirojpur",
  "rajbari",
  "rajshahi",
  "rangamati",
  "rangpur",
  "satkhira",
  "shariatpur",
  "sherpur",
  "sirajganj",
  "sunamganj",
  "sylhet",
  "tangail",
  "thakurgaon",
  // Common English aliases and former spellings.
  "barisal",
  "bogra",
  "chapai nawabganj",
  "chittagong",
  "coxs bazar",
  "comilla",
  "jessore",
  "jhalakathi",
  "khagrachari",
  "maulvibazar",
  "moulavi bazar",
]);
const SAFE_LOCATION_COMPONENT = /^[\p{L}\p{M}][\p{L}\p{M} .()'’-]*$/u;

export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ValidationError";
  }
}

function normalizeNumber(value, field, maximum) {
  if (
    typeof value !== "number"
    && (typeof value !== "string" || value.trim() === "")
  ) {
    throw new ValidationError(`${field} must be a finite number.`);
  }
  const normalized = Number(value);
  if (!Number.isFinite(normalized) || normalized <= 0 || normalized > maximum) {
    throw new ValidationError(`${field} must be greater than 0 and at most ${maximum}.`);
  }
  return normalized;
}

function normalizeLocationComponent(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/\s+/g, " ");
}

function districtNameFromComponent(value) {
  return normalizeLocationComponent(value)
    .replace(/\s+(?:sadar\s+upazila|district|division|upazila)$/, "");
}

function isBangladeshLocation(location) {
  const withoutCountry = location.replace(/,\s*bangladesh\s*$/i, "").trim();
  const components = withoutCountry.split(",").map((component) => component.trim());
  if (
    components.length === 0
    || components.length > 3
    || components.some((component) => !SAFE_LOCATION_COMPONENT.test(component))
  ) {
    return false;
  }

  const districtComponent = components.at(-1);
  return BANGLADESH_DISTRICTS.has(districtNameFromComponent(districtComponent));
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
    if (!isBangladeshLocation(location)) {
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
