/**
 * Run this script once to add campaign_id column to users table
 * Usage: node run_migration.js
 */
require('dotenv').config();
const { query } = require('./src/config/database');

async function runMigration() {
  console.log('Running migration: Adding campaign_id to users table...');
  try {
    await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS campaign_id INTEGER REFERENCES campaigns(id)`);
    console.log('✅ Column campaign_id added successfully.');
    await query(`CREATE INDEX IF NOT EXISTS idx_users_campaign_id ON users(campaign_id)`);
    console.log('✅ Index created successfully.');
    console.log('Migration complete!');
  } catch (err) {
    console.error('Migration failed:', err.message);
  } finally {
    process.exit(0);
  }
}

runMigration();
