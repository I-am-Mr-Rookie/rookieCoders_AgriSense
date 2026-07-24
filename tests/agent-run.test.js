import test from "node:test";
import assert from "node:assert/strict";

import {
  appendRunEvent,
  cancelAgentRun,
  completeAgentRun,
  createAgentRun,
  failAgentRun,
  getRunElapsedMs,
  toggleRunCollapsed,
} from "../src/agent-run.js";

test("creates a running agent run with the complete client contract", () => {
  const run = createAgentRun({
    id: "run-1",
    mode: "demo",
    startedAt: "2026-07-25T04:00:00.000Z",
  });

  assert.deepEqual(run, {
    id: "run-1",
    status: "running",
    mode: "demo",
    events: [],
    reasoningSummaries: [],
    startedAt: "2026-07-25T04:00:00.000Z",
    completedAt: null,
    collapsed: false,
    answer: "",
  });
});

test("appends streamed events in first-seen order and ignores duplicate IDs", () => {
  const initial = createAgentRun({
    id: "run-1",
    mode: "live",
    startedAt: 1_000,
  });
  const first = appendRunEvent(initial, {
    id: "activity-1",
    status: "running",
    timestamp: "2026-07-25T04:00:00.000Z",
  });
  const second = appendRunEvent(first, {
    id: "activity-2",
    status: "completed",
    durationMs: 243,
  });
  const duplicate = appendRunEvent(second, {
    id: "activity-1",
    status: "completed",
    durationMs: 999,
  });

  assert.deepEqual(initial.events, []);
  assert.deepEqual(
    duplicate.events.map((event) => event.id),
    ["activity-1", "activity-2"],
  );
  assert.equal(duplicate.events[0].durationMs, undefined);
  assert.equal(duplicate.events[1].durationMs, 243);
});

test("completes a run without changing recorded event durations or final output", () => {
  const running = appendRunEvent(
    createAgentRun({ id: "run-1", mode: "live", startedAt: 1_000 }),
    { id: "activity-1", status: "completed", durationMs: 47 },
  );

  const complete = completeAgentRun(running, {
    answer: "## Recommendation\n\nPlant **mustard**.",
    reasoningSummaries: [
      "Compared the forecast with the retrieved crop evidence.",
    ],
    completedAt: 4_500,
  });

  assert.equal(complete.status, "complete");
  assert.equal(complete.completedAt, 4_500);
  assert.equal(complete.answer, "## Recommendation\n\nPlant **mustard**.");
  assert.deepEqual(complete.reasoningSummaries, [
    "Compared the forecast with the retrieved crop evidence.",
  ]);
  assert.equal(complete.events[0].durationMs, 47);
  assert.equal(getRunElapsedMs(complete), 3_500);
});

test("derives running elapsed time only from run timestamps", () => {
  const run = appendRunEvent(
    createAgentRun({ id: "run-1", mode: "live", startedAt: 2_000 }),
    { id: "activity-1", status: "running" },
  );

  assert.equal(getRunElapsedMs(run, 2_750), 750);
  assert.equal(run.events[0].durationMs, undefined);
});

test("failed and cancelled runs remain expanded", () => {
  const collapsed = toggleRunCollapsed(
    createAgentRun({ id: "run-1", mode: "live", startedAt: 1_000 }),
  );

  const failed = failAgentRun(collapsed, {
    error: "Weather unavailable",
    completedAt: 2_000,
  });
  const cancelled = cancelAgentRun(collapsed, { completedAt: 2_500 });

  assert.equal(failed.status, "failed");
  assert.equal(failed.error, "Weather unavailable");
  assert.equal(failed.completedAt, 2_000);
  assert.equal(failed.collapsed, false);
  assert.equal(cancelled.status, "cancelled");
  assert.equal(cancelled.completedAt, 2_500);
  assert.equal(cancelled.collapsed, false);
  assert.equal("error" in cancelled, false);
});

test("toggles run expansion without mutating the input run", () => {
  const run = createAgentRun({
    id: "run-1",
    mode: "live",
    startedAt: 1_000,
  });

  const collapsed = toggleRunCollapsed(run);
  const expanded = toggleRunCollapsed(collapsed);

  assert.equal(run.collapsed, false);
  assert.equal(collapsed.collapsed, true);
  assert.equal(expanded.collapsed, false);
});

test("ignores late streamed events after every terminal status", () => {
  const running = appendRunEvent(
    createAgentRun({ id: "run-1", mode: "live", startedAt: 1_000 }),
    { id: "activity-1", status: "completed", durationMs: 47 },
  );
  const terminalRuns = [
    completeAgentRun(running, {
      answer: "Done",
      reasoningSummaries: [],
      completedAt: 2_000,
    }),
    failAgentRun(running, {
      error: "Weather unavailable",
      completedAt: 2_000,
    }),
    cancelAgentRun(running, { completedAt: 2_000 }),
  ];

  for (const terminal of terminalRuns) {
    const afterLateEvent = appendRunEvent(terminal, {
      id: "activity-late",
      status: "completed",
      durationMs: 999,
    });

    assert.equal(afterLateEvent, terminal);
    assert.deepEqual(
      afterLateEvent.events.map((event) => event.id),
      ["activity-1"],
    );
  }
});

test("preserves the first terminal transition", () => {
  const running = createAgentRun({
    id: "run-1",
    mode: "live",
    startedAt: 1_000,
  });
  const terminalRuns = [
    completeAgentRun(running, {
      answer: "First answer",
      reasoningSummaries: ["First summary"],
      completedAt: 2_000,
    }),
    failAgentRun(running, {
      error: "First error",
      completedAt: 2_100,
    }),
    cancelAgentRun(running, { completedAt: 2_200 }),
  ];

  for (const terminal of terminalRuns) {
    assert.equal(
      completeAgentRun(terminal, {
        answer: "Replacement answer",
        reasoningSummaries: ["Replacement summary"],
        completedAt: 3_000,
      }),
      terminal,
    );
    assert.equal(
      failAgentRun(terminal, {
        error: "Replacement error",
        completedAt: 3_100,
      }),
      terminal,
    );
    assert.equal(
      cancelAgentRun(terminal, { completedAt: 3_200 }),
      terminal,
    );
  }
});
