import pg from "pg";

const memory = new Map();
let pool;

function getPool() {
  if (!process.env.DATABASE_URL) return null;
  pool ??= new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
  return pool;
}

export function getDatabasePool() {
  return getPool();
}

export async function databaseStatus() {
  const db = getPool();
  if (!db) return { mode: "memory-fallback", connected: false };
  try {
    await db.query("SELECT 1");
    return { mode: "postgresql", connected: true };
  } catch (error) {
    return { mode: "postgresql", connected: false, error: error.message };
  }
}

export async function initializeDatabase() {
  const db = getPool();
  if (!db) return "memory";
  await db.query(`
    CREATE TABLE IF NOT EXISTS farm_sessions (
      id TEXT PRIMARY KEY,
      profile JSONB NOT NULL DEFAULT '{}'::jsonb,
      last_result JSONB,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  return "postgresql";
}

export async function loadSession(id) {
  const db = getPool();
  if (!db) return memory.get(id) ?? { id, profile: {}, lastResult: null };
  const result = await db.query("SELECT profile, last_result FROM farm_sessions WHERE id = $1", [id]);
  if (!result.rowCount) return { id, profile: {}, lastResult: null };
  return { id, profile: result.rows[0].profile, lastResult: result.rows[0].last_result };
}

export async function saveSession(session) {
  const db = getPool();
  if (!db) {
    memory.set(session.id, session);
    return;
  }
  await db.query(
    `INSERT INTO farm_sessions (id, profile, last_result, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (id) DO UPDATE
     SET profile = EXCLUDED.profile, last_result = EXCLUDED.last_result, updated_at = NOW()`,
    [session.id, session.profile, session.lastResult],
  );
}

export function databaseMode() {
  return process.env.DATABASE_URL ? "postgresql" : "memory-fallback";
}
