import test from "node:test";
import assert from "node:assert/strict";

import {
  createActivityEmitter,
  createNdjsonWriter,
  sanitizeActivityValue,
} from "../server/activity.js";

test("sanitizes credentials and farmer recovery IDs from activity details", () => {
  const safe = sanitizeActivityValue({
    location: "Gazipur",
    memoryId: "farm_0123456789abcdefghijklmn",
    apiKey: "sk-secret-value",
    nested: { authorization: "Bearer private", count: 4 },
  });

  assert.deepEqual(safe, {
    location: "Gazipur",
    memoryId: "[REDACTED]",
    apiKey: "[REDACTED]",
    nested: { authorization: "[REDACTED]", count: 4 },
  });
});

test("emits stable ordered activity events with bounded details", async () => {
  const events = [];
  let tick = 0;
  const emit = createActivityEmitter(
    (event) => events.push(event),
    () => new Date(1_000 + tick++ * 100),
  );

  await emit("weather.fetch.started", "Checking the live forecast", "running", {
    sourceUrl: "https://api.open-meteo.com/v1/forecast",
  });
  await emit("weather.fetch.completed", "Forecast retrieved", "completed", {
    precipitationMm: 18,
  }, 243);

  assert.deepEqual(events.map(({ id, type, status }) => ({ id, type, status })), [
    { id: "activity-1", type: "weather.fetch.started", status: "running" },
    { id: "activity-2", type: "weather.fetch.completed", status: "completed" },
  ]);
  assert.equal(events[1].durationMs, 243);
  assert.match(events[0].timestamp, /^1970-01-01T00:00:01/);
});

test("writes each activity event as one NDJSON line", () => {
  const writes = [];
  const res = {
    setHeader(name, value) {
      writes.push(["header", name, value]);
    },
    flushHeaders() {
      writes.push(["flush"]);
    },
    write(value) {
      writes.push(["write", value]);
    },
  };

  const write = createNdjsonWriter(res);
  write({ type: "request.accepted", status: "running" });

  assert.deepEqual(writes.slice(0, 3), [
    ["header", "Content-Type", "application/x-ndjson; charset=utf-8"],
    ["header", "Cache-Control", "no-cache, no-transform"],
    ["header", "X-Accel-Buffering", "no"],
  ]);
  assert.equal(writes.some((item) => item[0] === "flush"), true);
  assert.equal(
    writes.find((item) => item[0] === "write")[1],
    "{\"type\":\"request.accepted\",\"status\":\"running\"}\n",
  );
});
