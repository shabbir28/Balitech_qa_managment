// Apply only the additive migrations needed by the LA dashboard feature.
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env'), quiet: true });
const { pool } = require('../config/database');

async function migrate() {
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    // Serialize this feature's migrations across concurrent deployment attempts.
    await client.query('SELECT pg_advisory_xact_lock(78142026)');
    for (const file of [
      'migration_sale_duration.sql',
      'migration_la_recordings.sql',
      'migration_dynamic_dids.sql',
    ]) {
      await client.query(fs.readFileSync(path.join(__dirname, file), 'utf8'));
      console.log(`Applied: ${file}`);
    }
    await client.query('COMMIT');
    console.log('LA dashboard migration complete. Existing sales and evaluations preserved.');
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    console.error('LA dashboard migration failed:', error.message);
    process.exitCode = 1;
  } finally {
    client?.release();
    await pool.end();
  }
}

migrate();
