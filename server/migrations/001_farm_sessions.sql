CREATE TABLE IF NOT EXISTS farm_sessions (
  id TEXT PRIMARY KEY,
  profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_result JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
