const { query } = require('./src/config/database');

async function check() {
  const res = await query("SELECT phone, agent, dialer, sale_date FROM dialer_sales_history WHERE sale_date = '2026-08-12' LIMIT 5");
  console.table(res.rows);
  process.exit(0);
}

check();
