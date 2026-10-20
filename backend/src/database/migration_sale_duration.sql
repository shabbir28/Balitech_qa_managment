ALTER TABLE dialer_sales_history
  ADD COLUMN IF NOT EXISTS call_duration_seconds INTEGER
  CHECK (call_duration_seconds >= 0);
