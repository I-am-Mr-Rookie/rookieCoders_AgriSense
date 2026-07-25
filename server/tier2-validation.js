import { districtFromLocation, ValidationError } from "./validation.js";

export const MAX_DISEASE_IMAGE_BYTES = 5 * 1024 * 1024;

const MARKET_KINDS = new Set(["supplier_comparison", "market_price"]);
const MARKET_FIELDS = new Set(["kind", "crop", "location", "query", "responseLanguage"]);
const DISEASE_FIELDS = new Set(["imageDataUrl", "crop", "note", "responseLanguage"]);
const IMAGE_MEDIA_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const BASE64_PATTERN = /^[A-Za-z0-9+/]*={0,2}$/;

function boundedText(value, field, maximum, { required = false } = {}) {
  if (value === undefined || value === null) {
    if (required) throw new ValidationError(`${field} is required.`);
    return "";
  }
  if (typeof value !== "string") {
    throw new ValidationError(`${field} must be text.`);
  }
  const text = value.trim().replace(/\s+/g, " ");
  if (required && !text) throw new ValidationError(`${field} is required.`);
  if (text.length > maximum) {
    throw new ValidationError(`${field} must be ${maximum} characters or fewer.`);
  }
  return text;
}

function rejectUnknownFields(input, allowed, label) {
  const unknown = Object.keys(input).filter((field) => !allowed.has(field));
  if (unknown.length) {
    throw new ValidationError(`Unknown ${label} field: ${unknown.join(", ")}.`);
  }
}

export function validateMarketRequest(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new ValidationError("Market request must be an object.");
  }
  rejectUnknownFields(input, MARKET_FIELDS, "market request");
  if (!MARKET_KINDS.has(input.kind)) {
    throw new ValidationError(`kind must be one of: ${[...MARKET_KINDS].join(", ")}.`);
  }
  const location = boundedText(input.location, "location", 120, { required: true });
  if (!districtFromLocation(location)) {
    throw new ValidationError("location must name a Bangladesh district.");
  }
  return {
    kind: input.kind,
    crop: boundedText(input.crop, "crop", 80),
    location,
    query: boundedText(input.query, "query", 500, { required: true }),
    responseLanguage: boundedText(input.responseLanguage, "responseLanguage", 100),
  };
}

function canonicalizeUrl(value) {
  const url = new URL(value);
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  url.hash = "";
  url.hostname = url.hostname.toLowerCase();
  if (
    (url.protocol === "https:" && url.port === "443")
    || (url.protocol === "http:" && url.port === "80")
  ) {
    url.port = "";
  }
  const sorted = [...url.searchParams.entries()].sort(([leftKey, leftValue], [rightKey, rightValue]) =>
    leftKey.localeCompare(rightKey) || leftValue.localeCompare(rightValue)
  );
  url.search = "";
  for (const [key, item] of sorted) url.searchParams.append(key, item);
  if (url.pathname === "/") url.pathname = "";
  return url.toString();
}

export function normalizeSource(source) {
  if (!source || typeof source !== "object") return null;
  try {
    const url = canonicalizeUrl(source.url);
    if (!url) return null;
    const title = boundedText(source.title, "source title", 240) || new URL(url).hostname;
    return { url, title };
  } catch {
    return null;
  }
}

export function validateDiseaseImage(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new ValidationError("Disease image request must be an object.");
  }
  rejectUnknownFields(input, DISEASE_FIELDS, "disease image request");
  if (typeof input.imageDataUrl !== "string") {
    throw new ValidationError("Attach a JPEG, PNG, or WebP leaf image.");
  }
  const match = input.imageDataUrl.match(/^data:([^;,]+);base64,([\s\S]+)$/);
  const mediaType = match?.[1]?.toLowerCase();
  if (!IMAGE_MEDIA_TYPES.has(mediaType)) {
    throw new ValidationError("Attach a JPEG, PNG, or WebP leaf image.");
  }
  const base64 = match[2].replace(/\s+/g, "");
  const maximumEncodedLength = Math.ceil(MAX_DISEASE_IMAGE_BYTES / 3) * 4;
  if (base64.length > maximumEncodedLength) {
    throw new ValidationError("The attached image must be 5 MiB or smaller.");
  }
  if (!base64 || base64.length % 4 !== 0 || !BASE64_PATTERN.test(base64)) {
    throw new ValidationError("The attached image must contain valid Base64 data.");
  }
  const byteLength = Buffer.from(base64, "base64").byteLength;
  if (byteLength > MAX_DISEASE_IMAGE_BYTES) {
    throw new ValidationError("The attached image must be 5 MiB or smaller.");
  }
  return {
    imageDataUrl: `data:${mediaType};base64,${base64}`,
    mediaType,
    byteLength,
    crop: boundedText(input.crop, "crop", 80),
    note: boundedText(input.note, "note", 500),
    responseLanguage: boundedText(input.responseLanguage, "responseLanguage", 100),
  };
}
