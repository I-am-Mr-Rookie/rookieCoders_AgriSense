function firstFinite(...values) {
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number) && number >= 0) return number;
  }
  return 0;
}

export function derivePlanBudgetView(result = {}, savedProfile = {}, selectedCrop = {}) {
  result = result ?? {};
  savedProfile = savedProfile ?? {};
  selectedCrop = selectedCrop ?? {};
  const budgetBdt = firstFinite(
    result.budgetBdt,
    result.profile?.budgetBdt,
    savedProfile.budgetBdt,
  );
  const farmSizeAcres = firstFinite(
    result.originalFarmSizeAcres,
    result.profile?.farmSizeAcres,
    savedProfile.farmSizeAcres,
  );
  const plannedAreaAcres = firstFinite(result.plannedAreaAcres, farmSizeAcres);
  const plannedCostBdt = firstFinite(
    result.plannedFinancials?.totalCostBdt,
    selectedCrop.financials?.totalCostBdt,
  );

  return {
    budgetBdt,
    farmSizeAcres,
    plannedAreaAcres,
    plannedCostBdt,
    budgetRemainingBdt: Math.max(0, budgetBdt - plannedCostBdt),
  };
}
