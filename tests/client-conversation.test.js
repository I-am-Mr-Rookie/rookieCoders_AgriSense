import test from "node:test";
import assert from "node:assert/strict";

import {
  appendChatTurn,
  canCreatePlanFrom,
  completePlanRevision,
  createRevisionState,
} from "../src/conversation.js";

test("carries a pending clarification field into the next chat request", () => {
  const state = createRevisionState();
  const next = appendChatTurn([], "I want to change my budget.", {
    kind: "clarify_value",
    assistant: "What should your new total season budget be?",
    pendingField: "budgetBdt",
    changedFields: [],
    readyToPlan: false,
    planStale: false,
  }, state);

  assert.equal(next.revision.pendingField, "budgetBdt");
  assert.equal(next.revision.readyToPlan, false);
  assert.deepEqual(next.items.map((item) => item.role), ["farmer", "agent"]);
  assert.equal(next.items[1].run, undefined);
});

test("stages a lightweight revision card without creating an agent run", () => {
  const next = appendChatTurn([], "BDT 40,000", {
    kind: "revision_staged",
    assistant: "Budget updated from BDT 90,000 to BDT 40,000.",
    pendingField: "",
    changedFields: ["budgetBdt"],
    readyToPlan: true,
    planStale: true,
    profile: { budgetBdt: 40000 },
  }, { ...createRevisionState(), pendingField: "budgetBdt" });

  assert.deepEqual(next.revision.changedFields, ["budgetBdt"]);
  assert.equal(next.revision.readyToPlan, true);
  assert.equal(next.revision.planStale, true);
  assert.equal(next.items[1].revision.readyToPlan, true);
  assert.equal(next.items[1].run, undefined);
});

test("only the latest ready revision exposes Create updated plan", () => {
  const items = [
    { role: "agent", revision: { readyToPlan: true } },
    { role: "farmer", text: "One more change" },
    { role: "agent", revision: { readyToPlan: true } },
  ];

  assert.equal(canCreatePlanFrom(items, 0), false);
  assert.equal(canCreatePlanFrom(items, 2), true);
});

test("a successful plan clears draft state and marks revision cards complete", () => {
  const items = [
    { role: "agent", revision: { readyToPlan: true, planStale: true } },
    { role: "agent", run: { id: "run-1" } },
  ];
  const completed = completePlanRevision(items);

  assert.equal(completed.revision.readyToPlan, false);
  assert.equal(completed.revision.planStale, false);
  assert.deepEqual(completed.revision.changedFields, []);
  assert.deepEqual(completed.items[0].revision, {
    readyToPlan: false,
    planStale: false,
    completed: true,
  });
});
