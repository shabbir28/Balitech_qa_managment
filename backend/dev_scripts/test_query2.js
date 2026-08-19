const { pool } = require('./src/config/database');
async function run() {
  const client = await pool.connect();
  try {
    const res = await client.query('SELECT * FROM upload_batches ORDER BY id DESC LIMIT 5');
    console.log('Recent batches:', res.rows);
  } catch (e) { console.error(e); }
  finally { client.release(); process.exit(); }
}
run();
