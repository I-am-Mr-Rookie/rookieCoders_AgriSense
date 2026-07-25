CREATE TABLE IF NOT EXISTS farm_sessions (
  id TEXT PRIMARY KEY,
  profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_result JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS auth_users (
  id TEXT PRIMARY KEY,
  mobile_hash TEXT UNIQUE NOT NULL,
  mobile_last4 TEXT NOT NULL,
  mobile_ciphertext TEXT,
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

ALTER TABLE auth_daily_access ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 1;
