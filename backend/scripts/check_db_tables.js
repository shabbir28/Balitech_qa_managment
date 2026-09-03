require('dotenv').config();
const { query, pool } = require('../src/config/database');

async function check() {
  try {
    const tables = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    console.log('Tables:', tables.rows.map(r => r.table_name));

    const chCols = await query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'compare_history'
      ORDER BY ordinal_position;
    `);
    console.log('compare_history columns:', chCols.rows);

    const dshCols = await query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'dialer_sales_history'
      ORDER BY ordinal_position;
    `);
    console.log('dialer_sales_history columns:', dshCols.rows);

  } catch (err) {
    console.error('Error checking DB:', err);
  } finally {
    await pool.end();
  }
}

check();
