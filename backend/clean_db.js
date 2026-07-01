const { query } = require('./src/config/database');

async function cleanDb() {
  try {
    const result = await query(`
      SELECT tablename 
      FROM pg_catalog.pg_tables 
      WHERE schemaname = 'public';
    `);

    const tables = result.rows.map(row => row.tablename);
    
    // We keep users, campaigns, and roles. Agents is also kept as it's linked to users.
    const tablesToKeep = ['users', 'campaigns', 'roles', 'agents'];

    console.log("Found tables:", tables);
    
    for (const table of tables) {
      if (!tablesToKeep.includes(table)) {
        console.log(`Truncating table: ${table}`);
        await query(`TRUNCATE TABLE "${table}" CASCADE`);
      }
    }
    
    console.log("Database cleanup complete!");
    process.exit(0);
  } catch (err) {
    console.error("Error during cleanup:", err);
    process.exit(1);
  }
}

cleanDb();
