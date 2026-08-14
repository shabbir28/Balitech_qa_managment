const { query } = require('./src/config/database');
async function run() {
  const res = await query("SELECT phone, sale_date FROM dialer_sales_history WHERE phone = '8653682995'");
  const row = res.rows[0];
  const dateStr = row.sale_date instanceof Date ? row.sale_date.toISOString().split('T')[0] : String(row.sale_date).split('T')[0];
  console.log('Phone:', row.phone);
  console.log('Date object:', row.sale_date);
  console.log('DateStr:', dateStr);
  process.exit(0);
}
run();
