-- Migration: Add qa_override column to dialer_sales_history
-- Run this once on your PostgreSQL database

ALTER TABLE dialer_sales_history
  ADD COLUMN IF NOT EXISTS qa_override VARCHAR(50) DEFAULT NULL;

-- Optional index for faster filtering
CREATE INDEX IF NOT EXISTS idx_dialer_sales_qa_override
  ON dialer_sales_history(dialer, sale_date, qa_override);
