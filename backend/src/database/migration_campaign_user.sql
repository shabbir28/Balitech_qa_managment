-- Migration: Add campaign_id to users table
-- Run this once on your PostgreSQL database

ALTER TABLE users ADD COLUMN IF NOT EXISTS campaign_id INTEGER REFERENCES campaigns(id);

CREATE INDEX IF NOT EXISTS idx_users_campaign_id ON users(campaign_id);
