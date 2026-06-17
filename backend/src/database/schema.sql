-- BPO QA Management System - Database Schema
-- PostgreSQL

-- Drop tables if exist (for clean setup)
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS coaching_comments CASCADE;
DROP TABLE IF EXISTS feedback CASCADE;
DROP TABLE IF EXISTS evaluation_critical_errors CASCADE;
DROP TABLE IF EXISTS critical_errors CASCADE;
DROP TABLE IF EXISTS qa_evaluation_scores CASCADE;
DROP TABLE IF EXISTS qa_evaluations CASCADE;
DROP TABLE IF EXISTS call_leads CASCADE;
DROP TABLE IF EXISTS upload_batches CASCADE;
DROP TABLE IF EXISTS campaigns CASCADE;
DROP TABLE IF EXISTS agents CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS roles CASCADE;

-- =============================================
-- ROLES TABLE
-- =============================================
CREATE TABLE roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- =============================================
-- USERS TABLE
-- =============================================
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role_id INTEGER NOT NULL REFERENCES roles(id),
  agent_id VARCHAR(50) UNIQUE,
  department VARCHAR(100),
  phone VARCHAR(20),
  is_active BOOLEAN DEFAULT TRUE,
  last_login TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role_id ON users(role_id);
CREATE INDEX idx_users_agent_id ON users(agent_id);

-- =============================================
-- AGENTS TABLE (separate agent registry)
-- =============================================
CREATE TABLE agents (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  agent_id VARCHAR(50) UNIQUE NOT NULL,
  user_id INTEGER REFERENCES users(id),
  email VARCHAR(150),
  department VARCHAR(100),
  team_lead_id INTEGER REFERENCES users(id),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP
);

CREATE INDEX idx_agents_agent_id ON agents(agent_id);
CREATE INDEX idx_agents_user_id ON agents(user_id);

-- =============================================
-- CAMPAIGNS TABLE
-- =============================================
CREATE TABLE campaigns (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) UNIQUE NOT NULL,
  description TEXT,
  client_name VARCHAR(100),
  passing_score NUMERIC(5,2) DEFAULT 75.00,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP
);

CREATE INDEX idx_campaigns_name ON campaigns(name);

-- =============================================
-- UPLOAD BATCHES TABLE
-- =============================================
CREATE TABLE upload_batches (
  id SERIAL PRIMARY KEY,
  batch_name VARCHAR(200) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500),
  total_records INTEGER DEFAULT 0,
  successful_records INTEGER DEFAULT 0,
  duplicate_records INTEGER DEFAULT 0,
  failed_records INTEGER DEFAULT 0,
  uploaded_by INTEGER NOT NULL REFERENCES users(id),
  status VARCHAR(50) DEFAULT 'completed',
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_upload_batches_uploaded_by ON upload_batches(uploaded_by);
CREATE INDEX idx_upload_batches_created_at ON upload_batches(created_at);

-- =============================================
-- CALL LEADS TABLE
-- =============================================
CREATE TABLE call_leads (
  id SERIAL PRIMARY KEY,
  batch_id INTEGER REFERENCES upload_batches(id),
  agent_name VARCHAR(100) NOT NULL,
  agent_id VARCHAR(50) NOT NULL,
  campaign_name VARCHAR(150) NOT NULL,
  campaign_id INTEGER REFERENCES campaigns(id),
  customer_name VARCHAR(100),
  customer_phone VARCHAR(20) NOT NULL,
  call_date DATE,
  call_duration VARCHAR(20),
  recording_url TEXT,
  disposition VARCHAR(100),
  notes TEXT,
  is_evaluated BOOLEAN DEFAULT FALSE,
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP
);

CREATE INDEX idx_call_leads_agent_id ON call_leads(agent_id);
CREATE INDEX idx_call_leads_customer_phone ON call_leads(customer_phone);
CREATE INDEX idx_call_leads_campaign_id ON call_leads(campaign_id);
CREATE INDEX idx_call_leads_call_date ON call_leads(call_date);
CREATE INDEX idx_call_leads_batch_id ON call_leads(batch_id);
CREATE INDEX idx_call_leads_is_deleted ON call_leads(is_deleted);

-- =============================================
-- QA EVALUATIONS TABLE
-- =============================================
CREATE TABLE qa_evaluations (
  id SERIAL PRIMARY KEY,
  call_lead_id INTEGER NOT NULL REFERENCES call_leads(id),
  agent_name VARCHAR(100) NOT NULL,
  agent_id VARCHAR(50) NOT NULL,
  campaign_name VARCHAR(150) NOT NULL,
  campaign_id INTEGER REFERENCES campaigns(id),
  recording_url TEXT,
  opening_script_score NUMERIC(5,2) DEFAULT 0,
  verification_score NUMERIC(5,2) DEFAULT 0,
  product_knowledge_score NUMERIC(5,2) DEFAULT 0,
  compliance_score NUMERIC(5,2) DEFAULT 0,
  communication_score NUMERIC(5,2) DEFAULT 0,
  closing_score NUMERIC(5,2) DEFAULT 0,
  call_handling_score NUMERIC(5,2) DEFAULT 0,
  total_score NUMERIC(5,2) DEFAULT 0,
  passing_score NUMERIC(5,2) DEFAULT 75.00,
  status VARCHAR(20) DEFAULT 'Pass' CHECK (status IN ('Pass', 'Fail')),
  has_critical_error BOOLEAN DEFAULT FALSE,
  qa_remarks TEXT,
  evaluation_date DATE DEFAULT CURRENT_DATE,
  evaluated_by INTEGER NOT NULL REFERENCES users(id),
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP
);

CREATE INDEX idx_qa_evaluations_agent_id ON qa_evaluations(agent_id);
CREATE INDEX idx_qa_evaluations_campaign_id ON qa_evaluations(campaign_id);
CREATE INDEX idx_qa_evaluations_evaluation_date ON qa_evaluations(evaluation_date);
CREATE INDEX idx_qa_evaluations_evaluated_by ON qa_evaluations(evaluated_by);
CREATE INDEX idx_qa_evaluations_status ON qa_evaluations(status);
CREATE INDEX idx_qa_evaluations_call_lead_id ON qa_evaluations(call_lead_id);

-- =============================================
-- CRITICAL ERRORS TABLE (error type definitions)
-- =============================================
CREATE TABLE critical_errors (
  id SERIAL PRIMARY KEY,
  error_type VARCHAR(100) NOT NULL,
  description TEXT,
  severity VARCHAR(20) DEFAULT 'High' CHECK (severity IN ('Low', 'Medium', 'High', 'Critical')),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- =============================================
-- EVALUATION CRITICAL ERRORS TABLE
-- =============================================
CREATE TABLE evaluation_critical_errors (
  id SERIAL PRIMARY KEY,
  evaluation_id INTEGER NOT NULL REFERENCES qa_evaluations(id) ON DELETE CASCADE,
  critical_error_id INTEGER NOT NULL REFERENCES critical_errors(id),
  error_type VARCHAR(100) NOT NULL,
  error_description TEXT,
  timestamp_in_recording VARCHAR(20),
  severity VARCHAR(20) DEFAULT 'High' CHECK (severity IN ('Low', 'Medium', 'High', 'Critical')),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_eval_critical_errors_evaluation_id ON evaluation_critical_errors(evaluation_id);
CREATE INDEX idx_eval_critical_errors_critical_error_id ON evaluation_critical_errors(critical_error_id);

-- =============================================
-- FEEDBACK TABLE
-- =============================================
CREATE TABLE feedback (
  id SERIAL PRIMARY KEY,
  evaluation_id INTEGER NOT NULL REFERENCES qa_evaluations(id),
  agent_name VARCHAR(100) NOT NULL,
  agent_id VARCHAR(50) NOT NULL,
  agent_user_id INTEGER REFERENCES users(id),
  campaign_name VARCHAR(150),
  qa_score NUMERIC(5,2),
  status VARCHAR(20) NOT NULL,
  has_critical_errors BOOLEAN DEFAULT FALSE,
  qa_remarks TEXT,
  improvement_suggestions TEXT,
  feedback_status VARCHAR(50) DEFAULT 'Pending' CHECK (
    feedback_status IN ('Pending', 'Viewed by Agent', 'Acknowledged by Agent', 'Coaching Required', 'Closed')
  ),
  acknowledged_at TIMESTAMP,
  coaching_required BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_feedback_agent_id ON feedback(agent_id);
CREATE INDEX idx_feedback_evaluation_id ON feedback(evaluation_id);
CREATE INDEX idx_feedback_agent_user_id ON feedback(agent_user_id);
CREATE INDEX idx_feedback_feedback_status ON feedback(feedback_status);

-- =============================================
-- COACHING COMMENTS TABLE
-- =============================================
CREATE TABLE coaching_comments (
  id SERIAL PRIMARY KEY,
  feedback_id INTEGER NOT NULL REFERENCES feedback(id) ON DELETE CASCADE,
  comment TEXT NOT NULL,
  commented_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_coaching_comments_feedback_id ON coaching_comments(feedback_id);

-- =============================================
-- AUDIT LOGS TABLE
-- =============================================
CREATE TABLE audit_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50),
  resource_id INTEGER,
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- =============================================
-- SEED DATA
-- =============================================

-- Insert Roles
INSERT INTO roles (name, description) VALUES
  ('Manager', 'Full system access - manage everything'),
  ('User', 'View own data and perform basic tasks');

-- Insert Manager (password: Admin@123)
INSERT INTO users (name, email, password, role_id, department) VALUES
  ('System Manager', 'manager@bpoqa.com', '$2b$10$IIHZLNSEmiHj7INiLVDWPeJu6G/gw1aT4X5saGjDAygigtumrxIiO', 1, 'Administration');

-- Insert User (password: Admin@123)
INSERT INTO users (name, email, password, role_id, agent_id, department) VALUES
  ('Agent User', 'user@bpoqa.com', '$2b$10$IIHZLNSEmiHj7INiLVDWPeJu6G/gw1aT4X5saGjDAygigtumrxIiO', 2, 'AGT001', 'Operations');


-- Insert Sample Campaigns
INSERT INTO campaigns (name, description, client_name, passing_score) VALUES
  ('Sales Campaign A', 'Primary sales campaign for Q1', 'ABC Corp', 75.00),
  ('Customer Retention', 'Customer retention and upsell campaign', 'XYZ Ltd', 80.00),
  ('Collections Campaign', 'Debt collection campaign', 'Finance Co', 70.00),
  ('Tech Support', 'Technical support and troubleshooting', 'TechGiant', 78.00);

-- Insert Critical Error Types
INSERT INTO critical_errors (error_type, description, severity) VALUES
  ('Wrong Information Given', 'Agent provided incorrect or misleading product/service information to customer', 'Critical'),
  ('Compliance Disclaimer Missed', 'Agent failed to read mandatory compliance disclaimer during call', 'Critical'),
  ('Customer Consent Not Taken', 'Agent proceeded without obtaining required customer consent', 'Critical'),
  ('Fake Verification', 'Agent performed fake or improper identity verification', 'Critical'),
  ('Abusive Language', 'Agent used abusive, offensive, or inappropriate language', 'Critical'),
  ('DNC Customer Contacted', 'Agent contacted a customer listed on Do Not Call registry', 'Critical'),
  ('Misleading Customer', 'Agent deliberately misled customer about terms, pricing, or product features', 'Critical'),
  ('Call Script Not Followed', 'Agent deviated significantly from required call script', 'High'),
  ('Unprofessional Behavior', 'Agent displayed unprofessional behavior during customer interaction', 'High'),
  ('Data Privacy Breach', 'Agent disclosed sensitive customer data inappropriately', 'Critical');

-- Insert Sample Agent
INSERT INTO agents (name, agent_id, email, department) VALUES
  ('Mike Agent', 'AGT001', 'agent@bpoqa.com', 'Sales'),
  ('Lisa Brown', 'AGT002', 'lisa@bpoqa.com', 'Sales'),
  ('Tom Johnson', 'AGT003', 'tom@bpoqa.com', 'Support');

COMMIT;
