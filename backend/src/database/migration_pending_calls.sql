-- Migration: pending_calls table
-- Allows QA reviewers to save partial evaluation data for calls where
-- LA-side information is not yet available, without marking the call
-- as evaluated. The row is automatically cleaned up when the call is
-- finally submitted via createEvaluation.

CREATE TABLE IF NOT EXISTS pending_calls (
  id              SERIAL PRIMARY KEY,
  call_lead_id    INTEGER NOT NULL REFERENCES call_leads(id) ON DELETE CASCADE,
  saved_by        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  metadata        JSONB    NOT NULL DEFAULT '{}'::jsonb,
  recordings      JSONB    NOT NULL DEFAULT '[]'::jsonb,
  qa_status       VARCHAR(50)       DEFAULT 'Pending',
  evaluation_date DATE,
  notes           TEXT,
  created_at      TIMESTAMP         DEFAULT NOW(),
  updated_at      TIMESTAMP         DEFAULT NOW(),
  -- One pending draft per (call, user) pair
  UNIQUE (call_lead_id, saved_by)
);

CREATE INDEX IF NOT EXISTS idx_pending_calls_call_lead_id ON pending_calls(call_lead_id);
CREATE INDEX IF NOT EXISTS idx_pending_calls_saved_by     ON pending_calls(saved_by);
