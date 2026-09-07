const { pool } = require('../src/config/database');

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Add recordings column to call_leads
    await client.query(`
      ALTER TABLE call_leads 
      ADD COLUMN IF NOT EXISTS recordings JSONB DEFAULT '[]'::jsonb;
    `);
    console.log('Added recordings to call_leads');

    // 2. Add recordings column to qa_evaluations
    await client.query(`
      ALTER TABLE qa_evaluations 
      ADD COLUMN IF NOT EXISTS recordings JSONB DEFAULT '[]'::jsonb;
    `);
    console.log('Added recordings to qa_evaluations');

    // 3. Drop existing qa_evaluations_status_check constraint if exists
    await client.query(`
      ALTER TABLE qa_evaluations 
      DROP CONSTRAINT IF EXISTS qa_evaluations_status_check;
    `);

    // 4. Recreate constraint with all supported statuses
    await client.query(`
      ALTER TABLE qa_evaluations 
      ADD CONSTRAINT qa_evaluations_status_check 
      CHECK (status IN ('Pass', 'Fail', 'Flagged', 'Accepted', 'Rejected', 'Decline', 'Not Billable', 'Not Bilable'));
    `);
    console.log('Updated qa_evaluations_status_check constraint');

    await client.query('COMMIT');
    console.log('Migration completed successfully!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err);
  } finally {
    client.release();
    process.exit();
  }
}

migrate();
