import test from "node:test";
import assert from "node:assert/strict";

import { createPoolConfig } from "../server/db.js";

test("keeps certificate verification enabled by default", () => {
  const config = createPoolConfig({ DATABASE_URL: "postgresql://example.invalid/db" });

  assert.equal(config.connectionString, "postgresql://example.invalid/db");
  assert.equal(config.ssl, undefined);
});

test("allows an explicit target-only override for a self-signed database chain", () => {
  const config = createPoolConfig({
    DATABASE_URL: "postgresql://example.invalid/db",
    DATABASE_SSL_REJECT_UNAUTHORIZED: "false",
  });

  assert.deepEqual(config.ssl, { rejectUnauthorized: false });
});
