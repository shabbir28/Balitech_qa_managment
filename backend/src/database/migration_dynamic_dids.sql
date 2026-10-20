CREATE TABLE IF NOT EXISTS dashboard_dialer_presets (
  dialer VARCHAR(20) PRIMARY KEY,
  presets JSONB NOT NULL DEFAULT '{}',
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Version 2 retains all recordings, so changed DIDs can be matched immediately.
ALTER TABLE dashboard_la_recordings ADD COLUMN IF NOT EXISTS cache_version INTEGER NOT NULL DEFAULT 1;
