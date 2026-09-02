const { query, pool } = require('./src/config/database');

async function runMigration() {
  try {
    console.log('Adding is_assigned and assigned_qa_name to dialer_sales_history...');
    await query(`
      ALTER TABLE dialer_sales_history
      ADD COLUMN IF NOT EXISTS is_assigned BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS assigned_qa_name VARCHAR(255);
    `);
    console.log('Migration successful.');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    pool.end();
  }
}

runMigration();
