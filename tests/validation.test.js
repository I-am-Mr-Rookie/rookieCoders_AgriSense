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
