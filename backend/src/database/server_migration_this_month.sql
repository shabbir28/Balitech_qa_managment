-- ================================================================
-- BALITECH QA MANAGEMENT - SERVER DATABASE MIGRATION SCRIPT
-- Safe to run on existing production database (Idempotent)
-- ================================================================

BEGIN;

-- 1. Add recordings column to call_leads and qa_evaluations
ALTER TABLE call_leads 
ADD COLUMN IF NOT EXISTS recordings JSONB DEFAULT '[]'::jsonb;

ALTER TABLE qa_evaluations 
ADD COLUMN IF NOT EXISTS recordings JSONB DEFAULT '[]'::jsonb;

-- 2. Add campaign_id column to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS campaign_id INTEGER REFERENCES campaigns(id) ON DELETE SET NULL;

-- 3. Update qa_evaluations_status_check constraint to support all statuses
ALTER TABLE qa_evaluations 
DROP CONSTRAINT IF EXISTS qa_evaluations_status_check;

ALTER TABLE qa_evaluations 
ADD CONSTRAINT qa_evaluations_status_check 
CHECK (status IN ('Pass', 'Fail', 'Flagged', 'Accepted', 'Rejected', 'Decline', 'Not Billable', 'Not Bilable'));

-- 4. Ensure 'Manager' role exists in roles table
INSERT INTO roles (name, description)
VALUES ('Manager', 'Create teams, assign leads, manage QA members')
ON CONFLICT (name) DO NOTHING;

-- 5. Ensure dialer_sales_history table exists
CREATE TABLE IF NOT EXISTS dialer_sales_history (
  id SERIAL PRIMARY KEY,
  lead_id VARCHAR(100) NOT NULL,
  phone VARCHAR(50),
  status VARCHAR(50),
  campaign_id VARCHAR(100),
  agent VARCHAR(100),
  team VARCHAR(100),
  transfer_agent VARCHAR(100),
  qa_override VARCHAR(50),
  qa_status VARCHAR(50) DEFAULT 'Pending',
  is_assigned BOOLEAN DEFAULT FALSE,
  assigned_qa_name VARCHAR(100),
  sale_date DATE,
  call_date TIMESTAMP,
  dialer VARCHAR(20) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (lead_id, dialer)
);

ALTER TABLE dialer_sales_history ADD COLUMN IF NOT EXISTS is_assigned BOOLEAN DEFAULT FALSE;
ALTER TABLE dialer_sales_history ADD COLUMN IF NOT EXISTS assigned_qa_name VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_dialer_sales_sale_date ON dialer_sales_history(sale_date);
CREATE INDEX IF NOT EXISTS idx_dialer_sales_dialer ON dialer_sales_history(dialer);
CREATE INDEX IF NOT EXISTS idx_dialer_sales_qa_status ON dialer_sales_history(dialer, sale_date, qa_status);
CREATE INDEX IF NOT EXISTS idx_dialer_sales_qa_override ON dialer_sales_history(dialer, sale_date, qa_override);

-- 6. Ensure teams table exists
CREATE TABLE IF NOT EXISTS teams (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  manager_id INTEGER NOT NULL REFERENCES users(id),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_teams_manager_id ON teams(manager_id);

-- 7. Ensure team_members junction table exists
CREATE TABLE IF NOT EXISTS team_members (
  id SERIAL PRIMARY KEY,
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  added_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(team_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id);

-- 8. Ensure lead_assignments table exists
CREATE TABLE IF NOT EXISTS lead_assignments (
  id SERIAL PRIMARY KEY,
  call_lead_id INTEGER NOT NULL REFERENCES call_leads(id) ON DELETE CASCADE,
  assigned_to INTEGER NOT NULL REFERENCES users(id),
  assigned_by INTEGER NOT NULL REFERENCES users(id),
  campaign_name VARCHAR(150),
  status VARCHAR(30) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'completed', 'rejected', 'expired', 'pending_evaluation')),
  notes TEXT,
  assigned_at TIMESTAMP DEFAULT NOW(),
  accepted_at TIMESTAMP,
  completed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_lead_assignments_assigned_to ON lead_assignments(assigned_to);
CREATE INDEX IF NOT EXISTS idx_lead_assignments_call_lead_id ON lead_assignments(call_lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_assignments_status ON lead_assignments(status);

-- 9. Ensure compare_history table exists
CREATE TABLE IF NOT EXISTS compare_history (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  file_name VARCHAR(255),
  dialer_type VARCHAR(50),
  compare_date DATE,
  total_uploaded INTEGER DEFAULT 0,
  total_found INTEGER DEFAULT 0,
  not_found INTEGER DEFAULT 0,
  uploaded_data JSONB,
  result_data JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_compare_history_user_id ON compare_history(user_id);
CREATE INDEX IF NOT EXISTS idx_compare_history_compare_date ON compare_history(compare_date);

-- 10. Ensure transfer_assignments table exists
CREATE TABLE IF NOT EXISTS transfer_assignments (
  transfer_id VARCHAR(100) PRIMARY KEY,
  assigned_to INTEGER REFERENCES users(id),
  assigned_by INTEGER REFERENCES users(id),
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_transfer_assignments_assigned_to ON transfer_assignments(assigned_to);

-- 11. Ensure pending_calls table exists
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
  UNIQUE (call_lead_id, saved_by)
);

CREATE INDEX IF NOT EXISTS idx_pending_calls_call_lead_id ON pending_calls(call_lead_id);
CREATE INDEX IF NOT EXISTS idx_pending_calls_saved_by     ON pending_calls(saved_by);

-- 12. Update lead_assignments status check constraint to include 'pending_evaluation' & 'expired'
ALTER TABLE lead_assignments ADD COLUMN IF NOT EXISTS reopened_at TIMESTAMP;

ALTER TABLE lead_assignments DROP CONSTRAINT IF EXISTS lead_assignments_status_check;
ALTER TABLE lead_assignments ADD CONSTRAINT lead_assignments_status_check
  CHECK (status IN ('pending', 'accepted', 'completed', 'rejected', 'expired', 'pending_evaluation'));

COMMIT;
