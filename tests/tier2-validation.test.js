import test from "node:test";
import assert from "node:assert/strict";

import {
  MAX_DISEASE_IMAGE_BYTES,
  normalizeSource,
  validateDiseaseImage,
  validateMarketRequest,
} from "../server/tier2-validation.js";
import { responseLanguageName } from "../src/i18n.js";
import { ValidationError } from "../server/validation.js";

test("normalizes a bounded Bangladesh supplier-comparison request", () => {
  assert.deepEqual(validateMarketRequest({
    kind: "supplier_comparison",
    crop: " Maize ",
    location: " Gazipur ",
    query: " Compare seed suppliers near me ",
  }), {
    kind: "supplier_comparison",
    crop: "Maize",
    location: "Gazipur",
    query: "Compare seed suppliers near me",
    responseLanguage: "",
  });
});

test("accepts a market-price request without a crop", () => {
  assert.deepEqual(validateMarketRequest({
    kind: "market_price",
    location: "Dhaka",
    query: "What is the current wholesale potato price?",
    responseLanguage: "",
  }), {
    kind: "market_price",
    crop: "",
    location: "Dhaka",
    query: "What is the current wholesale potato price?",
    responseLanguage: "",
  });
});

test("rejects missing or unknown market request fields", () => {
  assert.throws(
    () => validateMarketRequest({ kind: "supplier_comparison", location: "Gazipur" }),
    ValidationError,
  );
  assert.throws(
    () => validateMarketRequest({ kind: "forecast", location: "Gazipur", query: "test" }),
    /kind must be one of/,
  );
  assert.throws(
    () => validateMarketRequest({
      kind: "market_price",
      location: "Gazipur",
      query: "test",
      secret: "not allowed",
    }),
    /Unknown market request field/,
  );
});

test("normalizes only safe web citations", () => {
  assert.deepEqual(normalizeSource({
    url: "HTTPS://Example.com:443/prices/?b=2&a=1#today",
    title: "  Daily prices  ",
  }), {
    url: "https://example.com/prices/?a=1&b=2",
    title: "Daily prices",
  });
  assert.equal(normalizeSource({ url: "javascript:alert(1)", title: "Unsafe" }), null);
  assert.equal(normalizeSource({ url: "not a URL", title: "Invalid" }), null);
});

test("validates a supported disease image data URL", () => {
  const result = validateDiseaseImage({
    imageDataUrl: "data:image/jpeg;base64,aGVsbG8=",
    crop: " Tomato ",
    note: " Brown spots appeared yesterday ",
  });

  assert.equal(result.mediaType, "image/jpeg");
  assert.equal(result.byteLength, 5);
  assert.equal(result.crop, "Tomato");
  assert.equal(result.note, "Brown spots appeared yesterday");
});

test("accepts the UI Bangla language guidance for disease images", () => {
  const result = validateDiseaseImage({
    imageDataUrl: "data:image/jpeg;base64,aGVsbG8=",
    responseLanguage: responseLanguageName("bn"),
  });
  assert.equal(result.responseLanguage, responseLanguageName("bn"));
});

test("rejects unsupported, malformed, and oversized disease images", () => {
  assert.throws(
    () => validateDiseaseImage({ imageDataUrl: "data:image/svg+xml;base64,PHN2Zz4=" }),
    /JPEG, PNG, or WebP/,
  );
  assert.throws(
    () => validateDiseaseImage({ imageDataUrl: "data:image/png;base64,%%%" }),
    /valid Base64/,
  );
  const oversized = Buffer.alloc(MAX_DISEASE_IMAGE_BYTES + 1).toString("base64");
  assert.throws(
    () => validateDiseaseImage({ imageDataUrl: `data:image/webp;base64,${oversized}` }),
    /5 MiB or smaller/,
  );
});
