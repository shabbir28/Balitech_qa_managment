-- ===================================================
-- MIGRATION: Close gaps between code and schema.sql
-- Run this once on your PostgreSQL database.
-- Safe to re-run (all statements are idempotent).
-- ===================================================

-- ---------------------------------------------------
-- 1. Allow the 'Flagged' evaluation outcome.
-- The original CHECK only permitted Pass/Fail, so any
-- evaluation submitted as Flagged was rejected outright.
-- ---------------------------------------------------
ALTER TABLE qa_evaluations
  DROP CONSTRAINT IF EXISTS qa_evaluations_status_check;

ALTER TABLE qa_evaluations
  ADD CONSTRAINT qa_evaluations_status_check
  CHECK (status IN ('Pass', 'Fail', 'Flagged'));

-- ---------------------------------------------------
-- 2. metadata column used by the spreadsheet-style
-- evaluation form (previously only added by the
-- ad-hoc scripts/fix_db.js helper).
-- ---------------------------------------------------
ALTER TABLE qa_evaluations
  ADD COLUMN IF NOT EXISTS metadata JSONB;

-- ---------------------------------------------------
-- 3. transfer_assignments: referenced by
-- transferQaController but never created anywhere.
-- transfer_id is the Google Sheet row identifier and
-- must be UNIQUE to support ON CONFLICT (transfer_id).
-- ---------------------------------------------------
CREATE TABLE IF NOT EXISTS transfer_assignments (
  id SERIAL PRIMARY KEY,
  transfer_id VARCHAR(100) NOT NULL UNIQUE,
  assigned_to INTEGER NOT NULL REFERENCES users(id),
  assigned_by INTEGER NOT NULL REFERENCES users(id),
  assigned_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transfer_assignments_assigned_to
  ON transfer_assignments(assigned_to);

-- ---------------------------------------------------
-- 4. dialer_sales_history.team: written and read by
-- dialerSalesController but missing from the table
-- created in init_dialer_history.js.
-- ---------------------------------------------------
ALTER TABLE dialer_sales_history
  ADD COLUMN IF NOT EXISTS team VARCHAR(100);
