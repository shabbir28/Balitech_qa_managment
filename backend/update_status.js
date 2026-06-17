require('dotenv').config();
const { query } = require('./src/config/database');

async function run() {
  try {
    await query("ALTER TABLE lead_assignments DROP CONSTRAINT IF EXISTS lead_assignments_status_check;");
    await query("ALTER TABLE lead_assignments ADD CONSTRAINT lead_assignments_status_check CHECK (status IN ('pending', 'accepted', 'completed', 'rejected'));");
    console.log("Migration successful");
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}
run();
