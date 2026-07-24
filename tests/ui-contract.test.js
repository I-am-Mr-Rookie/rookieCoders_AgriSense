import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const appSource = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");

test("recommendation shows the complete financial contract", () => {
  const labels = [
    "Itemized cost",
    "Total cost",
    "Expected yield",
    "Expected revenue",
    "Net profit",
    "ROI",
    "Break-even yield",
  ];
  const missing = labels.filter((label) => !appSource.includes(label));

  assert.deepEqual(missing, []);
});
