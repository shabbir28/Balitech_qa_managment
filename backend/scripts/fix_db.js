const { query, pool } = require('../src/config/database');

async function fixDB() {
  try {
    await query(`ALTER TABLE qa_evaluations ADD COLUMN IF NOT EXISTS metadata JSONB`);
    console.log('Successfully added metadata column to qa_evaluations');
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    pool.end();
  }
}

fixDB();
