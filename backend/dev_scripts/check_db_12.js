const { query } = require('./src/config/database');

async function check() {
  const res = await query("SELECT phone, agent, sale_date FROM dialer_sales_history WHERE sale_date = '2026-08-12' LIMIT 10");
  console.log("DB Records for Aug 12:");
  console.table(res.rows);
  process.exit(0);
}

check();
