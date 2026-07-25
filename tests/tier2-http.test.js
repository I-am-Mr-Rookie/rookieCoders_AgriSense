import test from "node:test";
import assert from "node:assert/strict";

import { createTier2Handlers } from "../server/tier2-http.js";
import { Tier2UnavailableError } from "../server/market-intelligence.js";
import { ValidationError } from "../server/validation.js";

function responseRecorder() {
  return {
    statusCode: 200,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
  };
}

test("market route returns the normalized service result", async () => {
  const expected = { kind: "market_price", summary: "Current result", sources: [] };
  const handlers = createTier2Handlers({
    marketService: { research: async (body) => ({ ...expected, request: body }) },
  });
  const res = responseRecorder();

  await handlers.market({ body: { kind: "market_price" } }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.payload, { ...expected, request: { kind: "market_price" } });
});

test("Tier 2 validation and configuration failures remain recoverable and sanitized", async () => {
  const validationHandlers = createTier2Handlers({
    diseaseService: {
      async diagnose() {
        throw new ValidationError("Attach a JPEG, PNG, or WebP leaf image.");
      },
    },
  });
  const validationResponse = responseRecorder();
  await validationHandlers.disease({ body: {} }, validationResponse);

  assert.equal(validationResponse.statusCode, 400);
  assert.deepEqual(validationResponse.payload, {
    error: "Attach a JPEG, PNG, or WebP leaf image.",
    phase: "Tier-2",
    recoverable: true,
  });

  const unavailableHandlers = createTier2Handlers({
    realtimeService: {
      async createClientSecret() {
        throw new Tier2UnavailableError("Realtime voice is unavailable.");
      },
    },
  });
  const unavailableResponse = responseRecorder();
  await unavailableHandlers.realtime({ body: {} }, unavailableResponse);

  assert.equal(unavailableResponse.statusCode, 503);
  assert.deepEqual(unavailableResponse.payload, {
    error: "Realtime voice is unavailable.",
    phase: "Tier-2",
    recoverable: true,
  });
});

test("unexpected Tier 2 failures return an opaque request ID", async () => {
  const logged = [];
  const handlers = createTier2Handlers({
    marketService: {
      async research() {
        throw new Error("upstream secret detail");
      },
    },
    log: (...items) => logged.push(items),
  });
  const res = responseRecorder();

  await handlers.market({ body: {} }, res);

  assert.equal(res.statusCode, 502);
  assert.equal(res.payload.error, "AgriSense could not complete this Tier 2 request.");
  assert.equal(res.payload.phase, "Tier-2");
  assert.equal(res.payload.recoverable, true);
  assert.match(res.payload.errorId, /^[0-9a-f-]{36}$/);
  assert.doesNotMatch(JSON.stringify(res.payload), /secret detail/);
  assert.equal(logged.length, 1);
});
