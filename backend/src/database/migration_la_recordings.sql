-- Separate dashboard cache: existing sales and recording modules are unchanged.
CREATE TABLE IF NOT EXISTS dashboard_la_recordings (
  dialer VARCHAR(20) NOT NULL,
  lead_id VARCHAR(50) NOT NULL,
  recordings JSONB NOT NULL DEFAULT '[]',
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (dialer, lead_id)
);
