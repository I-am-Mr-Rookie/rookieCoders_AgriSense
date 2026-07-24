import test from "node:test";
import assert from "node:assert/strict";

import {
  focusTranscriptItem,
  isNearTranscriptBottom,
  pinTranscript,
} from "../src/chat-scroll.js";

test("detects whether the farmer is already near the transcript bottom", () => {
  assert.equal(isNearTranscriptBottom({
    scrollHeight: 1000,
    scrollTop: 520,
    clientHeight: 430,
  }), true);
  assert.equal(isNearTranscriptBottom({
    scrollHeight: 1000,
    scrollTop: 300,
    clientHeight: 430,
  }), false);
});

test("pins transcript updates immediately without a smooth-scroll feedback loop", () => {
  const calls = [];
  const element = {
    scrollHeight: 1120,
    scrollTo(options) {
      calls.push(options);
    },
  };

  pinTranscript(element);

  assert.deepEqual(calls, [{ top: 1120, behavior: "auto" }]);
});

test("completed answers align to their first line instead of a clipped tail", () => {
  const calls = [];
  const transcript = {
    scrollTop: 420,
    getBoundingClientRect: () => ({ top: 100 }),
    scrollTo: (options) => calls.push(options),
  };
  const answer = {
    getBoundingClientRect: () => ({ top: 260 }),
  };

  focusTranscriptItem(transcript, answer, 12);

  assert.deepEqual(calls, [{ top: 568, behavior: "auto" }]);
});
