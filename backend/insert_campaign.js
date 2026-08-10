const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function run() {
  try {
    const res = await pool.query("INSERT INTO campaigns (name, description, client_name, passing_score) VALUES ('Pharmacy', 'Pharmacy Campaign', 'Internal', 75) RETURNING *");
    console.log('Inserted:', res.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
        console.log('Campaign already exists');
    } else {
        console.error(err);
    }
  } finally {
    await pool.end();
  }
}

run();
