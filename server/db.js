import crypto from "node:crypto";
import pg from "pg";

const memory = new Map();
const authUsers = new Map();
const authSessions = new Map();
const loginChallenges = new Map();
const dailyAccess = new Map();
let pool;

export function createPoolConfig(env = process.env) {
  const config = { connectionString: env.DATABASE_URL, max: 5 };
  if (env.DATABASE_SSL_REJECT_UNAUTHORIZED === "false") {
    const url = new URL(config.connectionString);
    for (const parameter of ["sslmode", "uselibpqcompat", "sslcert", "sslkey", "sslrootcert"]) {
      url.searchParams.delete(parameter);
    }
    config.connectionString = url.toString();
    config.ssl = { rejectUnauthorized: false };
  }
  return config;
}

function getPool() {
  if (!process.env.DATABASE_URL) return null;
  pool ??= new pg.Pool(createPoolConfig());
  return pool;
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
  await db.query(`
    CREATE TABLE IF NOT EXISTS auth_users (
      id TEXT PRIMARY KEY,
      mobile_hash TEXT UNIQUE NOT NULL,
      mobile_last4 TEXT NOT NULL,
      mobile_ciphertext TEXT,
      password_salt TEXT,
      password_hash TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS auth_sessions (
      session_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS auth_sessions_user_id_idx ON auth_sessions(user_id);
    CREATE INDEX IF NOT EXISTS auth_sessions_expires_at_idx ON auth_sessions(expires_at);
    ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS mobile_ciphertext TEXT;
    ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS password_salt TEXT;
    ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS password_hash TEXT;
    CREATE TABLE IF NOT EXISTS auth_login_challenges (
      id TEXT PRIMARY KEY,
      mobile_hash TEXT NOT NULL,
      otp_hash TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      max_attempts INTEGER NOT NULL DEFAULT 5,
      used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS auth_login_challenges_mobile_idx
      ON auth_login_challenges(mobile_hash, created_at DESC);
    CREATE TABLE IF NOT EXISTS auth_daily_access (
      user_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
      access_date DATE NOT NULL,
      external_trx_id TEXT UNIQUE NOT NULL,
      amount_bdt NUMERIC(8,2) NOT NULL DEFAULT 5.00,
      state TEXT NOT NULL,
      provider_code TEXT,
      attempt_count INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, access_date)
    );
    ALTER TABLE auth_daily_access ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 1
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

export async function deleteSession(id) {
  const db = getPool();
  if (!db) return memory.delete(id);
  const result = await db.query("DELETE FROM farm_sessions WHERE id = $1", [id]);
  return result.rowCount > 0;
}

export function databaseMode() {
  return process.env.DATABASE_URL ? "postgresql" : "memory-fallback";
}

export async function upsertAuthUser({ mobileHash, mobileLast4, mobileCiphertext }) {
  const db = getPool();
  if (!db) {
    const existing = authUsers.get(mobileHash);
    if (existing) {
      Object.assign(existing, { mobileLast4, mobileCiphertext });
      return existing;
    }
    const user = { id: crypto.randomUUID(), mobileHash, mobileLast4, mobileCiphertext, passwordSalt: null, passwordHash: null };
    authUsers.set(mobileHash, user);
    return user;
  }
  const result = await db.query(
    `INSERT INTO auth_users (id, mobile_hash, mobile_last4, mobile_ciphertext)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (mobile_hash) DO UPDATE
     SET mobile_last4 = EXCLUDED.mobile_last4,
         mobile_ciphertext = EXCLUDED.mobile_ciphertext,
         updated_at = NOW()
     RETURNING id, mobile_hash AS "mobileHash", mobile_last4 AS "mobileLast4",
               mobile_ciphertext AS "mobileCiphertext", password_salt AS "passwordSalt",
               password_hash AS "passwordHash"`,
    [crypto.randomUUID(), mobileHash, mobileLast4, mobileCiphertext],
  );
  return result.rows[0];
}

export async function loadAuthUserByMobileHash(mobileHash) {
  const db = getPool();
  if (!db) return authUsers.get(mobileHash) ?? null;
  const result = await db.query(
    `SELECT id, mobile_hash AS "mobileHash", mobile_last4 AS "mobileLast4",
            mobile_ciphertext AS "mobileCiphertext", password_salt AS "passwordSalt",
            password_hash AS "passwordHash"
     FROM auth_users WHERE mobile_hash = $1`,
    [mobileHash],
  );
  return result.rows[0] ?? null;
}

export async function setAuthPassword({ userId, passwordSalt, passwordHash }) {
  const db = getPool();
  if (!db) {
    const user = [...authUsers.values()].find((item) => item.id === userId);
    if (!user) return false;
    Object.assign(user, { passwordSalt, passwordHash });
    return true;
  }
  const result = await db.query(
    `UPDATE auth_users
     SET password_salt = $2, password_hash = $3, updated_at = NOW()
     WHERE id = $1`,
    [userId, passwordSalt, passwordHash],
  );
  return result.rowCount === 1;
}

export async function createAuthSession({ sessionHash, userId, expiresAt }) {
  const db = getPool();
  if (!db) {
    authSessions.set(sessionHash, { sessionHash, userId, expiresAt });
    return;
  }
  await db.query(
    `INSERT INTO auth_sessions (session_hash, user_id, expires_at)
     VALUES ($1, $2, $3)`,
    [sessionHash, userId, expiresAt],
  );
}

export async function loadAuthSession(sessionHash) {
  const db = getPool();
  if (!db) {
    const session = authSessions.get(sessionHash);
    if (!session) return null;
    const user = [...authUsers.values()].find((item) => item.id === session.userId);
    return user ? { ...session, user } : null;
  }
  const result = await db.query(
    `SELECT s.expires_at AS "expiresAt", u.id, u.mobile_last4 AS "mobileLast4",
            u.mobile_ciphertext AS "mobileCiphertext", u.password_hash AS "passwordHash"
     FROM auth_sessions s
     JOIN auth_users u ON u.id = s.user_id
     WHERE s.session_hash = $1`,
    [sessionHash],
  );
  if (!result.rowCount) return null;
  return {
    expiresAt: result.rows[0].expiresAt,
    user: {
      id: result.rows[0].id,
      mobileLast4: result.rows[0].mobileLast4,
      mobileCiphertext: result.rows[0].mobileCiphertext,
      passwordHash: result.rows[0].passwordHash,
    },
  };
}

export async function deleteAuthSession(sessionHash) {
  const db = getPool();
  if (!db) return authSessions.delete(sessionHash);
  const result = await db.query("DELETE FROM auth_sessions WHERE session_hash = $1", [sessionHash]);
  return result.rowCount > 0;
}

export async function deleteAuthUser(userId) {
  const db = getPool();
  if (!db) {
    const entry = [...authUsers.entries()].find(([, user]) => user.id === userId);
    if (!entry) return false;
    authUsers.delete(entry[0]);
    for (const [hash, session] of authSessions) {
      if (session.userId === userId) authSessions.delete(hash);
    }
    return true;
  }
  const result = await db.query("DELETE FROM auth_users WHERE id = $1", [userId]);
  return result.rowCount === 1;
}

export async function createLoginChallenge(record) {
  const db = getPool();
  if (!db) {
    loginChallenges.set(record.id, { ...record, attempts: 0, usedAt: null });
    return;
  }
  await db.query(
    `INSERT INTO auth_login_challenges
       (id, mobile_hash, otp_hash, expires_at, max_attempts)
     VALUES ($1, $2, $3, $4, $5)`,
    [record.id, record.mobileHash, record.otpHash, record.expiresAt, record.maxAttempts],
  );
}

export async function deleteLoginChallenge(id) {
  const db = getPool();
  if (!db) return loginChallenges.delete(id);
  const result = await db.query("DELETE FROM auth_login_challenges WHERE id = $1", [id]);
  return result.rowCount > 0;
}

export async function consumeLoginChallenge({ id, mobileHash, otpHash, now }) {
  const db = getPool();
  if (!db) {
    const challenge = loginChallenges.get(id);
    if (!challenge || challenge.mobileHash !== mobileHash) return { status: "missing" };
    if (challenge.usedAt) return { status: "used" };
    if (new Date(challenge.expiresAt).getTime() <= new Date(now).getTime()) return { status: "expired" };
    if (challenge.attempts >= challenge.maxAttempts) return { status: "locked" };
    challenge.attempts += 1;
    if (challenge.otpHash !== otpHash) {
      return { status: challenge.attempts >= challenge.maxAttempts ? "locked" : "invalid" };
    }
    challenge.usedAt = now;
    return { status: "valid" };
  }

  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `SELECT mobile_hash AS "mobileHash", otp_hash AS "otpHash",
              expires_at AS "expiresAt", attempts,
              max_attempts AS "maxAttempts", used_at AS "usedAt"
         FROM auth_login_challenges
        WHERE id = $1
        FOR UPDATE`,
      [id],
    );
    const challenge = result.rows[0];
    let status;
    if (!challenge || challenge.mobileHash !== mobileHash) status = "missing";
    else if (challenge.usedAt) status = "used";
    else if (new Date(challenge.expiresAt).getTime() <= new Date(now).getTime()) status = "expired";
    else if (challenge.attempts >= challenge.maxAttempts) status = "locked";
    else if (challenge.otpHash !== otpHash) {
      const attempts = challenge.attempts + 1;
      await client.query("UPDATE auth_login_challenges SET attempts = $2 WHERE id = $1", [id, attempts]);
      status = attempts >= challenge.maxAttempts ? "locked" : "invalid";
    } else {
      await client.query(
        "UPDATE auth_login_challenges SET attempts = attempts + 1, used_at = $2 WHERE id = $1",
        [id, now],
      );
      status = "valid";
    }
    await client.query("COMMIT");
    return { status };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export async function loadDailyAccess(userId, accessDate) {
  const db = getPool();
  const key = `${userId}:${accessDate}`;
  if (!db) return dailyAccess.get(key) ?? null;
  const result = await db.query(
    `SELECT user_id AS "userId", access_date::text AS "accessDate",
            external_trx_id AS "externalTrxId", amount_bdt::text AS "amountBdt",
            state, provider_code AS "providerCode", attempt_count AS "attemptCount"
       FROM auth_daily_access
      WHERE user_id = $1 AND access_date = $2`,
    [userId, accessDate],
  );
  return result.rows[0] ?? null;
}

export async function claimDailyAccess(record) {
  const db = getPool();
  const key = `${record.userId}:${record.accessDate}`;
  if (!db) {
    const existing = dailyAccess.get(key);
    if (existing && existing.state !== "FAILED") return false;
    dailyAccess.set(key, {
      ...record,
      state: "PENDING",
      attemptCount: Number(existing?.attemptCount || 0) + 1,
    });
    return true;
  }
  const result = await db.query(
    `INSERT INTO auth_daily_access
       (user_id, access_date, external_trx_id, amount_bdt, state, attempt_count)
     VALUES ($1, $2, $3, $4, 'PENDING', 1)
     ON CONFLICT (user_id, access_date) DO UPDATE
       SET external_trx_id = EXCLUDED.external_trx_id,
           amount_bdt = EXCLUDED.amount_bdt,
           state = 'PENDING',
           provider_code = NULL,
           attempt_count = auth_daily_access.attempt_count + 1,
           updated_at = NOW()
       WHERE auth_daily_access.state = 'FAILED'
     RETURNING user_id`,
    [record.userId, record.accessDate, record.externalTrxId, record.amountBdt],
  );
  return result.rowCount > 0;
}

export async function completeDailyAccess(userId, accessDate, update) {
  const db = getPool();
  const key = `${userId}:${accessDate}`;
  if (!db) {
    const record = { ...dailyAccess.get(key), ...update };
    dailyAccess.set(key, record);
    return record;
  }
  await db.query(
    `UPDATE auth_daily_access
        SET state = $3, provider_code = $4, updated_at = NOW()
      WHERE user_id = $1 AND access_date = $2`,
    [userId, accessDate, update.state, update.providerCode ?? null],
  );
  return loadDailyAccess(userId, accessDate);
}
