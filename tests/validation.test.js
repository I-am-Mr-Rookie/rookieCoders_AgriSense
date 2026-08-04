import test from "node:test";
import assert from "node:assert/strict";

import {
  ValidationError,
  publicFailure,
  validateProfilePatch,
} from "../server/validation.js";

test("accepts and normalizes a complete Gazipur Rabi profile patch", () => {
  const patch = validateProfilePatch({
    location: "  Gazipur, Bangladesh  ",
    farmSizeAcres: "2.5",
    soilType: "  Sandy Loam ",
    waterAvailability: " IRRIGATED ",
    budgetBdt: "125000",
    targetSeason: " rabi ",
  });

  assert.deepEqual(patch, {
    location: "Gazipur, Bangladesh",
    farmSizeAcres: 2.5,
    soilType: "sandy loam",
    waterAvailability: "irrigated",
    budgetBdt: 125000,
    targetSeason: "Rabi",
  });
});

test("accepts a partial profile patch without adding missing fields", () => {
  assert.deepEqual(validateProfilePatch({ location: "  Gazipur  " }), {
    location: "Gazipur",
  });
});

test("accepts Bangladesh district and common district-style locations", () => {
  for (const location of [
    "Gazipur",
    "Dhaka, Bangladesh",
    "Chattogram District, Bangladesh",
    "Bogura",
    "Cumilla, Bangladesh",
  ]) {
    assert.deepEqual(validateProfilePatch({ location }), { location }, location);
  }
});

test("canonicalizes Bangla district names for downstream weather and planning", () => {
  assert.deepEqual(validateProfilePatch({ location: "গাজীপুর" }), { location: "Gazipur" });
  assert.deepEqual(validateProfilePatch({ location: "কুমিল্লা" }), { location: "Cumilla" });
  assert.deepEqual(validateProfilePatch({ location: "চট্টগ্রাম, বাংলাদেশ" }), { location: "Chattogram" });
});

test("extracts the canonical district from every supported location form", async () => {
  const { districtFromLocation } = await import("../server/validation.js");
  const cases = new Map([
    ["Gazipur", "Gazipur"],
    ["Dhaka, Bangladesh", "Dhaka"],
    ["Chittagong District, Bangladesh", "Chattogram"],
    ["Bogra District", "Bogura"],
    ["Comilla, Bangladesh", "Cumilla"],
  ]);

  for (const [location, district] of cases) {
    assert.equal(districtFromLocation(location), district, location);
  }
});

test("rejects unknown profile fields", () => {
  assert.throws(
    () => validateProfilePatch({ location: "Gazipur", ownerName: "Internal only" }),
    ValidationError,
  );
});

test("rejects locations with obvious non-Bangladesh country tokens", () => {
  for (const location of [
    "Kolkata, India",
    "Lahore, Pakistan",
    "Austin, USA",
    "Austin, United States",
    "London, UK",
    "London, United Kingdom",
  ]) {
    assert.throws(() => validateProfilePatch({ location }), ValidationError, location);
  }
});

test("rejects obvious non-Bangladesh and unknown locations", () => {
  for (const location of [
    "Tokyo, Japan",
    "Paris, France",
    "Kathmandu, Nepal",
    "New York",
    "Unknown Farm Region",
  ]) {
    assert.throws(() => validateProfilePatch({ location }), ValidationError, location);
  }
});

test("rejects free-form locality prefixes before Bangladesh district anchors", () => {
  for (const location of [
    "Tokyo, Dhaka, Bangladesh",
    "Paris, Chattogram",
    "New York, Gazipur District, Bangladesh",
    "Tokyo Upazila, Dhaka, Bangladesh",
    "Paris Upazila, Chattogram, Bangladesh",
    "Gazipur District, Sylhet Division, Bangladesh",
    "Mymensingh Division",
    "Sreepur Upazila, Gazipur, Bangladesh",
  ]) {
    assert.throws(() => validateProfilePatch({ location }), ValidationError, location);
  }
});

test("rejects invalid farm sizes", () => {
  for (const farmSizeAcres of ["not-a-number", Infinity, -Infinity, 0, -1, 100.01]) {
    assert.throws(
      () => validateProfilePatch({ farmSizeAcres }),
      ValidationError,
      String(farmSizeAcres),
    );
  }
});

test("rejects invalid budgets", () => {
  for (const budgetBdt of ["not-a-number", Infinity, -Infinity, 0, -1, 100000001]) {
    assert.throws(
      () => validateProfilePatch({ budgetBdt }),
      ValidationError,
      String(budgetBdt),
    );
  }
});

test("rejects coercible non-numeric farm-size and budget input types", () => {
  const invalidValues = [true, false, [], ["2"], {}, null, "", "   "];

  for (const field of ["farmSizeAcres", "budgetBdt"]) {
    for (const value of invalidValues) {
      assert.throws(
        () => validateProfilePatch({ [field]: value }),
        ValidationError,
        `${field}: ${JSON.stringify(value)}`,
      );
    }
  }
});

test("rejects non-decimal numeric strings", () => {
  for (const field of ["farmSizeAcres", "budgetBdt"]) {
    for (const value of ["0x10", "0b10", "Infinity", "1e3"]) {
      assert.throws(
        () => validateProfilePatch({ [field]: value }),
        ValidationError,
        `${field}: ${value}`,
      );
    }
  }
});

test("rejects unsupported soil values", () => {
  assert.throws(
    () => validateProfilePatch({ soilType: "silt" }),
    ValidationError,
  );
});

test("rejects unsupported water availability values", () => {
  assert.throws(
    () => validateProfilePatch({ waterAvailability: "abundant" }),
    ValidationError,
  );
});

test("rejects target seasons other than Rabi", () => {
  assert.throws(
    () => validateProfilePatch({ targetSeason: "Kharif" }),
    ValidationError,
  );
});

test("returns an opaque client-safe dependency failure", () => {
  const failure = publicFailure("opaque-error-id");

  assert.deepEqual(failure, {
    error: "AgriSense could not complete this step. Your saved farm details are safe; please retry.",
    errorId: "opaque-error-id",
    phase: "Tier-0",
    recoverable: true,
  });
  assert.equal(JSON.stringify(failure).includes("provider"), false);
  assert.equal(JSON.stringify(failure).includes("database"), false);
});
