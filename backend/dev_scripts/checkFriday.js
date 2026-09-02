const { Pool } = require('pg');
require('dotenv').config({ path: __dirname + '/.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function check() {
  try {
    const res = await pool.query(`
      SELECT status, COUNT(*) 
      FROM dialer_sales_history 
      WHERE dialer = 'medicare' 
        AND sale_date = '2026-08-21'
      GROUP BY status
      ORDER BY count DESC
    `);
    console.log("Friday Medicare breakdown:");
    console.table(res.rows);
    
    const res2 = await pool.query(`
      SELECT COUNT(*) FROM dialer_sales_history 
      WHERE dialer = 'medicare' 
        AND sale_date = '2026-08-21'
    `);
    console.log("Total for 2026-08-21:", res2.rows[0].count);

  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}

check();
