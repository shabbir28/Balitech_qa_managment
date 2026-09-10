-- Migration: QA Daily Report handwritten summaries
-- Run this once on your PostgreSQL database. Safe to re-run.
--
-- Stores the Summary text a QA/admin writes on the QA Daily Report.
-- qa_user_id = 0 is the team-wide rollup; campaign_key = '' means All Campaigns.
-- The backend also creates this table lazily on first save, so applying it here
-- just avoids the DDL happening during a user request.

CREATE TABLE IF NOT EXISTS qa_daily_report_summaries (
  id SERIAL PRIMARY KEY,
  qa_user_id INTEGER NOT NULL DEFAULT 0,
  from_date DATE NOT NULL,
  to_date DATE NOT NULL,
  campaign_key TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (qa_user_id, from_date, to_date, campaign_key)
);

-- Safety net: the editable evaluation dropdown lists. Already in schema.sql and
-- also created lazily, included here in case this database predates it.
CREATE TABLE IF NOT EXISTS evaluation_dropdown_options (
  id SERIAL PRIMARY KEY,
  field VARCHAR(50) NOT NULL,
  value VARCHAR(255) NOT NULL,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (field, value)
);

-- Verify
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('qa_daily_report_summaries', 'evaluation_dropdown_options')
ORDER BY table_name;
