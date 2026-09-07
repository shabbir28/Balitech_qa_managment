-- Migration: Add qa_status column to dialer_sales_history
-- Run this once on your PostgreSQL database

ALTER TABLE dialer_sales_history
  ADD COLUMN IF NOT EXISTS qa_status VARCHAR(50) DEFAULT 'Pending';

-- Update any existing null rows to 'Pending'
UPDATE dialer_sales_history
  SET qa_status = 'Pending'
  WHERE qa_status IS NULL;

-- Optional index for faster filtering
CREATE INDEX IF NOT EXISTS idx_dialer_sales_qa_status
  ON dialer_sales_history(dialer, sale_date, qa_status);
