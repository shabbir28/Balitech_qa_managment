-- ===================================================
-- MIGRATION: Manager/Team/Assignment feature
-- ===================================================

-- Add Manager role if not exists
INSERT INTO roles (name, description)
SELECT 'Manager', 'Create teams, assign leads, manage QA members'
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name = 'Manager');

-- Add pre-defined campaigns
INSERT INTO campaigns (name, description, client_name, passing_score)
SELECT 'ACA Medicare FE', 'ACA Medicare Front End campaign', 'ACA', 75.00
WHERE NOT EXISTS (SELECT 1 FROM campaigns WHERE name = 'ACA Medicare FE');

INSERT INTO campaigns (name, description, client_name, passing_score)
SELECT 'Med Alert', 'Med Alert outbound campaign', 'Med Alert', 75.00
WHERE NOT EXISTS (SELECT 1 FROM campaigns WHERE name = 'Med Alert');

-- Teams table
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

-- Team members junction table
CREATE TABLE IF NOT EXISTS team_members (
  id SERIAL PRIMARY KEY,
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  added_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(team_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id);

-- Lead assignments table
CREATE TABLE IF NOT EXISTS lead_assignments (
  id SERIAL PRIMARY KEY,
  call_lead_id INTEGER NOT NULL REFERENCES call_leads(id) ON DELETE CASCADE,
  assigned_to INTEGER NOT NULL REFERENCES users(id),
  assigned_by INTEGER NOT NULL REFERENCES users(id),
  campaign_name VARCHAR(150),
  status VARCHAR(30) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'completed', 'rejected')),
  notes TEXT,
  assigned_at TIMESTAMP DEFAULT NOW(),
  accepted_at TIMESTAMP,
  completed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_lead_assignments_assigned_to ON lead_assignments(assigned_to);
CREATE INDEX IF NOT EXISTS idx_lead_assignments_call_lead_id ON lead_assignments(call_lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_assignments_status ON lead_assignments(status);

COMMIT;
