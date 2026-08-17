const { query } = require('./src/config/database');

async function check() {
  const res = await query("SELECT COUNT(*) as count FROM dialer_sales_history WHERE sale_date IN ('2026-08-12', '2026-08-13') AND agent NOT LIKE '%(%)%'");
  console.log('Records missing agent ID:', res.rows[0].count);
  process.exit(0);
}
check();
