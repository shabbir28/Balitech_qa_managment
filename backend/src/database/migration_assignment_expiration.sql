-- Migration: Add 'expired' status to lead_assignments table
-- Allows uncompleted assignments from previous days to be marked as expired.

ALTER TABLE lead_assignments DROP CONSTRAINT IF EXISTS lead_assignments_status_check;
ALTER TABLE lead_assignments ADD CONSTRAINT lead_assignments_status_check 
  CHECK (status IN ('pending', 'accepted', 'completed', 'rejected', 'expired'));

CREATE INDEX IF NOT EXISTS idx_lead_assignments_active_assigned_at
  ON lead_assignments (status, assigned_at)
  WHERE status IN ('pending', 'accepted');

-- Lets a QA Agent re-open a lead from an earlier day without the expiration
-- job immediately closing it again.
ALTER TABLE lead_assignments ADD COLUMN IF NOT EXISTS reopened_at TIMESTAMP;
