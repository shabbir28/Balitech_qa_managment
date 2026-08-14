const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { query } = require('../src/config/database');

const sql = `
CREATE TABLE IF NOT EXISTS compare_history (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  file_name VARCHAR(255) NOT NULL,
  dialer_type VARCHAR(50),
  compare_date DATE NOT NULL,
  total_uploaded INTEGER,
  total_found INTEGER,
  not_found INTEGER,
  uploaded_data JSONB,
  result_data JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_compare_history_user_id ON compare_history(user_id);
CREATE INDEX IF NOT EXISTS idx_compare_history_date ON compare_history(compare_date);
`;

async function run() {
  try {
    console.log('Running migration for compare_history...');
    await query(sql);
    console.log('Migration successful!');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    process.exit(0);
  }
}
run();
