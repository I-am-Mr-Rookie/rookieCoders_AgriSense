import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pg from "pg";
import { createPoolConfig } from "../src/database.js";

dotenv.config({ path: fileURLToPath(new URL("../../.env", import.meta.url)) });

const { Client } = pg;
const databaseUrl = process.env.DATABASE_URL || "postgres://bdapps:bdapps@127.0.0.1:5433/bdapps";
const sqlPath = fileURLToPath(new URL("../db/001_init.sql", import.meta.url));
const client = new Client(createPoolConfig(databaseUrl));

await client.connect();
try {
  await client.query(await readFile(sqlPath, "utf8"));
  console.info("Database migration complete");
} finally {
  await client.end();
}
