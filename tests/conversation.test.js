import test from "node:test";
import assert from "node:assert/strict";

import { interpretConversationTurn } from "../server/conversation.js";

const profile = {
  location: "Gazipur",
  farmSizeAcres: 1,
  soilType: "loam",
  waterAvailability: "irrigated",
  budgetBdt: 90000,
  targetSeason: "Rabi",
};

test("asks only for the new value when the farmer names budget", () => {
  assert.deepEqual(
    interpretConversationTurn("I want to change my budget.", profile),
    {
      kind: "clarify_value",
      assistant: "What should your new total season budget be?",
      pendingField: "budgetBdt",
      patch: {},
      changedFields: [],
    },
  );
});

test("uses the pending budget field to understand a value-only reply", () => {
  assert.deepEqual(
    interpretConversationTurn("BDT 40,000", profile, { pendingField: "budgetBdt" }),
    {
      kind: "revision_staged",
      assistant: "Budget updated from BDT 90,000 to BDT 40,000. Your previous recommendation will stay visible until you create the updated plan.",
      pendingField: "",
      patch: { budgetBdt: 40000 },
      changedFields: ["budgetBdt"],
    },
  );
});

test("stages a direct budget revision without a redundant question", () => {
  const result = interpretConversationTurn("Change my budget to BDT 40,000.", profile);
  assert.equal(result.kind, "revision_staged");
  assert.deepEqual(result.patch, { budgetBdt: 40000 });
  assert.equal(result.pendingField, "");
});

test("asks which detail when the edit request is generic", () => {
  const result = interpretConversationTurn("I want to change my plan.", profile);
  assert.equal(result.kind, "clarify_field");
  assert.equal(result.pendingField, "");
  assert.match(result.assistant, /budget, farm size, soil, water availability, location, or season/i);
});

test("continues a generic edit by asking for the selected field value", () => {
  const result = interpretConversationTurn("Budget", profile, { awaitingField: true });
  assert.equal(result.kind, "clarify_value");
  assert.equal(result.pendingField, "budgetBdt");
  assert.match(result.assistant, /new total season budget/i);
});

test("reports invalid budget values without discarding the pending field", () => {
  const result = interpretConversationTurn("BDT 0", profile, { pendingField: "budgetBdt" });
  assert.equal(result.kind, "invalid_value");
  assert.equal(result.pendingField, "budgetBdt");
  assert.match(result.assistant, /greater than BDT 0/i);
  assert.deepEqual(result.patch, {});
});

test("recognizes other editable farm details", () => {
  assert.deepEqual(
    interpretConversationTurn("Make my farm size 2.5 acres", profile).patch,
    { farmSizeAcres: 2.5 },
  );
  assert.deepEqual(
    interpretConversationTurn("Change soil to sandy loam", profile).patch,
    { soilType: "sandy loam" },
  );
  assert.deepEqual(
    interpretConversationTurn("I now have limited water", profile).patch,
    { waterAvailability: "limited" },
  );
  assert.deepEqual(
    interpretConversationTurn("Change location to Mymensingh", profile).patch,
    { location: "Mymensingh" },
  );
  assert.deepEqual(
    interpretConversationTurn("Set season to Rabi", { ...profile, targetSeason: "" }).patch,
    { targetSeason: "Rabi" },
  );
});

test("does not stage unchanged values", () => {
  const result = interpretConversationTurn("Change my budget to BDT 90,000", profile);
  assert.equal(result.kind, "unchanged");
  assert.deepEqual(result.patch, {});
  assert.match(result.assistant, /already BDT 90,000/i);
});

test("leaves unrelated questions for the general chat path", () => {
  assert.deepEqual(
    interpretConversationTurn("Why did maize rank first?", profile),
    {
      kind: "general",
      assistant: "",
      pendingField: "",
      patch: {},
      changedFields: [],
    },
  );
});

