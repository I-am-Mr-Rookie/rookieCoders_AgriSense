import test from "node:test";
import assert from "node:assert/strict";

import { derivePlanBudgetView } from "../src/plan-budget.js";

test("an empty initial React state is null-safe", () => {
  assert.deepEqual(derivePlanBudgetView(null, null, null), {
    budgetBdt: 0,
    farmSizeAcres: 0,
    plannedAreaAcres: 0,
    plannedCostBdt: 0,
    budgetRemainingBdt: 0,
  });
});

test("legacy saved plans retain the persisted budget and farm size without NaN values", () => {
  const view = derivePlanBudgetView(
    { crops: [{ financials: { totalCostBdt: 650000 } }] },
    { budgetBdt: 50000, farmSizeAcres: 10 },
    { financials: { totalCostBdt: 650000 } },
  );

  assert.deepEqual(view, {
    budgetBdt: 50000,
    farmSizeAcres: 10,
    plannedAreaAcres: 10,
    plannedCostBdt: 650000,
    budgetRemainingBdt: 0,
  });
});

test("new selected plans use their affordable planted area and saved budget", () => {
  const view = derivePlanBudgetView(
    { budgetBdt: 50000, originalFarmSizeAcres: 10, plannedAreaAcres: 0.7692 },
    {},
    { financials: { totalCostBdt: 50000 } },
  );

  assert.equal(view.plannedAreaAcres, 0.7692);
  assert.equal(view.budgetRemainingBdt, 0);
});
