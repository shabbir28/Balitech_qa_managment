const { query } = require('./src/config/database');

async function check() {
  const res = await query("SELECT dialer, COUNT(*) as count FROM dialer_sales_history WHERE sale_date IN ('2026-08-12', '2026-08-13') AND agent NOT LIKE '%(%)%' GROUP BY dialer");
  console.table(res.rows);
  process.exit(0);
}
check();
