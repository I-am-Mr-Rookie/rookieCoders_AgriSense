import test from "node:test";
import assert from "node:assert/strict";

import { createHttpErrorHandler } from "../server/http.js";

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

test("malformed JSON returns a sanitized recoverable 400", () => {
  const res = responseRecorder();
  createHttpErrorHandler(() => {})({ type: "entity.parse.failed", stack: "private" }, {}, res);

  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.payload, {
    error: "Malformed JSON request body.",
    phase: "Tier-0",
    recoverable: true,
  });
  assert.doesNotMatch(JSON.stringify(res.payload), /private/);
});

test("oversized JSON returns a sanitized recoverable 413", () => {
  const res = responseRecorder();
  createHttpErrorHandler(() => {})({ type: "entity.too.large", stack: "private" }, {}, res);

  assert.equal(res.statusCode, 413);
  assert.equal(res.payload.error, "Request body is too large.");
  assert.equal(res.payload.recoverable, true);
  assert.doesNotMatch(JSON.stringify(res.payload), /private/);
});

test("unexpected middleware errors return an opaque JSON failure", () => {
  const logged = [];
  const res = responseRecorder();
  createHttpErrorHandler((...items) => logged.push(items))(new Error("secret database detail"), {}, res);

  assert.equal(res.statusCode, 500);
  assert.equal(res.payload.error, "Unexpected server error.");
  assert.match(res.payload.errorId, /^[0-9a-f-]{36}$/);
  assert.doesNotMatch(JSON.stringify(res.payload), /secret database detail/);
  assert.equal(logged.length, 1);
});
