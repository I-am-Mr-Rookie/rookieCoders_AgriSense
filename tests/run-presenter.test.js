import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_DEMO_STEP_DELAY_MS,
  createRunPresenter,
} from "../src/run-presenter.js";

function nextTurn() {
  return new Promise((resolve) => setImmediate(resolve));
}

test("live mode reveals every event immediately without artificial waits", async () => {
  const revealed = [];
  const waits = [];
  const presenter = createRunPresenter({
    mode: "live",
    reveal: (event) => revealed.push(event),
    wait: async (delayMs) => waits.push(delayMs),
  });
  const first = { id: "one", durationMs: 41 };
  const second = { id: "two", durationMs: 73 };

  presenter.present(first);
  presenter.present(second);

  assert.deepEqual(revealed, [first, second]);
  assert.deepEqual(waits, []);
  await presenter.drain();
});

test("demo mode reveals events serially with the configured pacing delay", async () => {
  const revealed = [];
  const pendingWaits = [];
  const presenter = createRunPresenter({
    mode: "demo",
    stepDelayMs: 260,
    reveal: (event) => revealed.push(event.id),
    wait: (delayMs) => new Promise((resolve) => {
      pendingWaits.push({ delayMs, resolve });
    }),
  });

  presenter.present({ id: "one" });
  presenter.present({ id: "two" });
  presenter.present({ id: "three" });
  await Promise.resolve();

  assert.deepEqual(revealed, ["one"]);
  assert.equal(pendingWaits[0].delayMs, 260);

  pendingWaits.shift().resolve();
  await nextTurn();
  assert.deepEqual(revealed, ["one", "two"]);

  pendingWaits.shift().resolve();
  await nextTurn();
  assert.deepEqual(revealed, ["one", "two", "three"]);

  pendingWaits.shift().resolve();
  await presenter.drain();
});

test("demo mode defaults to roughly 250 to 300 milliseconds per step", () => {
  assert.ok(DEFAULT_DEMO_STEP_DELAY_MS >= 250);
  assert.ok(DEFAULT_DEMO_STEP_DELAY_MS <= 300);
  const elevenEventDemoWithCompletionPause =
    (11 * DEFAULT_DEMO_STEP_DELAY_MS) + 600;
  assert.ok(elevenEventDemoWithCompletionPause >= 3_000);
  assert.ok(elevenEventDemoWithCompletionPause <= 4_000);
});

test("presentation never changes recorded event durations", async () => {
  const event = Object.freeze({ id: "one", durationMs: 987 });
  const revealed = [];
  const presenter = createRunPresenter({
    mode: "demo",
    reveal: (nextEvent) => revealed.push(nextEvent),
    wait: async () => {},
  });

  presenter.present(event);
  await presenter.drain();

  assert.equal(revealed[0], event);
  assert.equal(revealed[0].durationMs, 987);
});

test("drain resolves only after all queued demo presentation completes", async () => {
  const revealed = [];
  const waitResolvers = [];
  let drained = false;
  const presenter = createRunPresenter({
    mode: "demo",
    reveal: (event) => revealed.push(event.id),
    wait: () => new Promise((resolve) => waitResolvers.push(resolve)),
  });

  presenter.present({ id: "one" });
  presenter.present({ id: "two" });
  void presenter.drain().then(() => {
    drained = true;
  });
  await Promise.resolve();

  assert.equal(drained, false);
  waitResolvers.shift()();
  await nextTurn();
  assert.equal(drained, false);
  waitResolvers.shift()();
  await presenter.drain();
  assert.equal(drained, true);
  assert.deepEqual(revealed, ["one", "two"]);
});

test("cancellation prevents later queued reveals and never rejects drain", async () => {
  const revealed = [];
  let releaseFirstWait;
  const presenter = createRunPresenter({
    mode: "demo",
    reveal: (event) => revealed.push(event.id),
    wait: () => new Promise((resolve) => {
      releaseFirstWait ??= resolve;
    }),
  });

  presenter.present({ id: "one" });
  presenter.present({ id: "two" });
  presenter.present({ id: "three" });
  await Promise.resolve();
  presenter.cancel();
  releaseFirstWait();

  await assert.doesNotReject(presenter.drain());
  assert.deepEqual(revealed, ["one"]);
});
