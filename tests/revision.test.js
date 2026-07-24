import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("release revision trims APP_REVISION and falls back to unknown", async () => {
  const { getReleaseRevision } = await import("../server/revision.js");

  assert.equal(getReleaseRevision({ APP_REVISION: "  abc123  " }), "abc123");
  assert.equal(getReleaseRevision({ APP_REVISION: "   " }), "unknown");
  assert.equal(getReleaseRevision({}), "unknown");
});

test("health response exposes the release revision", () => {
  const source = readFileSync(new URL("../server/index.js", import.meta.url), "utf8");

  assert.match(source, /releaseRevision:\s*getReleaseRevision\(\)/);
});
