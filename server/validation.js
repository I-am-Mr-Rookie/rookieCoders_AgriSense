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
const DISTRICT_NAMES = [
  "Bagerhat",
  "Bandarban",
  "Barguna",
  "Barishal",
  "Bhola",
  "Bogura",
  "Brahmanbaria",
  "Chandpur",
  "Chapainawabganj",
  "Chattogram",
  "Chuadanga",
  "Cox's Bazar",
  "Cumilla",
  "Dhaka",
  "Dinajpur",
  "Faridpur",
  "Feni",
  "Gaibandha",
  "Gazipur",
  "Gopalganj",
  "Habiganj",
  "Jamalpur",
  "Jashore",
  "Jhalokati",
  "Jhenaidah",
  "Joypurhat",
  "Khagrachhari",
  "Khulna",
  "Kishoreganj",
  "Kurigram",
  "Kushtia",
  "Lakshmipur",
  "Lalmonirhat",
  "Madaripur",
  "Magura",
  "Manikganj",
  "Meherpur",
  "Moulvibazar",
  "Munshiganj",
  "Mymensingh",
  "Naogaon",
  "Narail",
  "Narayanganj",
  "Narsingdi",
  "Natore",
  "Netrokona",
  "Nilphamari",
  "Noakhali",
  "Pabna",
  "Panchagarh",
  "Patuakhali",
  "Pirojpur",
  "Rajbari",
  "Rajshahi",
  "Rangamati",
  "Rangpur",
  "Satkhira",
  "Shariatpur",
  "Sherpur",
  "Sirajganj",
  "Sunamganj",
  "Sylhet",
  "Tangail",
  "Thakurgaon",
];
const DISTRICT_BY_NAME = new Map(
  DISTRICT_NAMES.map((district) => [district.toLowerCase(), district]),
);
const DISTRICT_ALIASES = new Map([
  ["barisal", "Barishal"],
  ["bogra", "Bogura"],
  ["chapai nawabganj", "Chapainawabganj"],
  ["chittagong", "Chattogram"],
  ["coxs bazar", "Cox's Bazar"],
  ["comilla", "Cumilla"],
  ["jessore", "Jashore"],
  ["jhalakathi", "Jhalokati"],
  ["khagrachari", "Khagrachhari"],
  ["maulvibazar", "Moulvibazar"],
  ["moulavi bazar", "Moulvibazar"],
]);
const SAFE_LOCATION_COMPONENT = /^[\p{L}\p{M}][\p{L}\p{M} .()'\u2019-]*$/u;
const DECIMAL_NUMBER = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/;

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
  const text = typeof value === "string" ? value.trim() : null;
  if (text !== null && !DECIMAL_NUMBER.test(text)) {
    throw new ValidationError(`${field} must be an ordinary decimal number.`);
  }
  const normalized = text === null ? value : Number(text);
  if (!Number.isFinite(normalized) || normalized <= 0 || normalized > maximum) {
    throw new ValidationError(`${field} must be greater than 0 and at most ${maximum}.`);
  }
  return normalized;
}

function normalizeLocationComponent(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\u2018\u2019`]/g, "'")
    .replace(/\s+/g, " ");
}

function canonicalDistrict(value) {
  const normalized = normalizeLocationComponent(value);
  return DISTRICT_BY_NAME.get(normalized) ?? DISTRICT_ALIASES.get(normalized) ?? null;
}

function districtComponent(value) {
  const normalized = normalizeLocationComponent(value);
  const match = normalized.match(/^(.+)\s+district$/);
  if (match) return canonicalDistrict(match[1]);
  return canonicalDistrict(normalized);
}

export function districtFromLocation(location) {
  if (typeof location !== "string" || !location.trim()) return null;
  const components = location.split(",").map((component) => component.trim());
  if (
    components.length === 0
    || components.length > 2
    || components.some((component) => !SAFE_LOCATION_COMPONENT.test(component))
  ) {
    return null;
  }

  if (normalizeLocationComponent(components.at(-1)) === "bangladesh") {
    components.pop();
  }
  if (
    components.length !== 1
    || components.some((component) => normalizeLocationComponent(component) === "bangladesh")
  ) {
    return null;
  }

  return districtComponent(components[0]);
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
    if (!districtFromLocation(location)) {
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
