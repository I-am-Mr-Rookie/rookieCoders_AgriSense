import test from "node:test";
import assert from "node:assert/strict";

import { consumeNdjsonStream } from "../src/stream.js";

function responseFromChunks(chunks) {
  let index = 0;
  return {
    ok: true,
    body: {
      getReader() {
        return {
          async read() {
            if (index >= chunks.length) return { done: true, value: undefined };
            return { done: false, value: new TextEncoder().encode(chunks[index++]) };
          },
        };
      },
    },
  };
}

test("consumes split NDJSON activity and returns the final result", async () => {
  const activities = [];
  const response = responseFromChunks([
    "{\"id\":\"activity-1\",\"type\":\"request.accepted\",\"status\":\"running\"}\n{\"id\":\"activity-",
    "2\",\"type\":\"weather.fetch.completed\",\"status\":\"completed\"}\n",
    "{\"type\":\"result\",\"status\":\"completed\",\"data\":{\"assistant\":\"**Done**\",\"crops\":[]}}\n",
  ]);

  const result = await consumeNdjsonStream(response, (event) => activities.push(event));

  assert.deepEqual(activities.map((item) => item.id), ["activity-1", "activity-2"]);
  assert.equal(result.assistant, "**Done**");
});

test("surfaces a sanitized terminal stream failure", async () => {
  const response = responseFromChunks([
    "{\"id\":\"activity-error\",\"type\":\"request.failed\",\"status\":\"failed\",\"details\":{\"error\":\"Weather unavailable\",\"recoverable\":true}}\n",
  ]);

  await assert.rejects(
    consumeNdjsonStream(response, () => {}),
    /Weather unavailable/,
  );
});

test("rejects a stream that ends without a final result", async () => {
  const response = responseFromChunks([
    "{\"id\":\"activity-1\",\"type\":\"request.accepted\",\"status\":\"running\"}\n",
  ]);

  await assert.rejects(
    consumeNdjsonStream(response, () => {}),
    /ended before a final result/,
  );
});
