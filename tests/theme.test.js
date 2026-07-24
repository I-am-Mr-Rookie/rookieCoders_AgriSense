import test from "node:test";
import assert from "node:assert/strict";

import {
  applyTheme,
  loadThemePreference,
  persistThemePreference,
} from "../src/theme.js";

test("defaults to system and accepts only system, light, or dark", () => {
  assert.equal(loadThemePreference({ getItem: () => null }), "system");
  assert.equal(loadThemePreference({ getItem: () => "dark" }), "dark");
  assert.equal(loadThemePreference({ getItem: () => "unknown" }), "system");
});

test("persists an explicit theme without failing in locked storage", () => {
  const values = new Map();
  assert.equal(persistThemePreference("light", { setItem: (key, value) => values.set(key, value) }), "light");
  assert.equal(values.get("agrisense.theme"), "light");
  assert.doesNotThrow(() => persistThemePreference("dark", { setItem: () => { throw new Error("blocked"); } }));
});

test("applies system, light, and dark themes to the document root", () => {
  const attributes = new Map();
  const root = {
    setAttribute: (name, value) => attributes.set(name, value),
    removeAttribute: (name) => attributes.delete(name),
  };

  applyTheme("dark", root);
  assert.equal(attributes.get("data-theme"), "dark");
  applyTheme("light", root);
  assert.equal(attributes.get("data-theme"), "light");
  applyTheme("system", root);
  assert.equal(attributes.has("data-theme"), false);
});
