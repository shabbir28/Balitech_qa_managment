const fs = require('fs');
const path = require('path');
const { pool } = require('../config/database');

async function runMigration() {
  const client = await pool.connect();
  try {
    console.log('🚀 Starting database migration...');
    const sqlPath = path.join(__dirname, 'server_migration_this_month.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    await client.query(sql);
    console.log('✅ Migration applied successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
    process.exit(0);
  }
}

runMigration();
