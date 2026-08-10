const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'bpo_qa_system',
  password: process.env.DB_PASSWORD || '123443',
  port: process.env.DB_PORT || 5432,
});

async function migrate() {
  try {
    await pool.query("UPDATE roles SET name = 'Super Admin' WHERE name = 'Manager'");
    console.log("Renamed 'Manager' to 'Super Admin'");
    await pool.query("UPDATE roles SET name = 'QA Agent' WHERE name = 'User'");
    console.log("Renamed 'User' to 'QA Agent'");
    const check = await pool.query("SELECT * FROM roles WHERE name = 'QA Admin'");
    if (check.rows.length === 0) {
      await pool.query("INSERT INTO roles (name, description) VALUES ('QA Admin', 'System access but cannot add/manage users')");
      console.log("Inserted 'QA Admin'");
    }
  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    pool.end();
  }
}

migrate();
