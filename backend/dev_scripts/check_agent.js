const { query } = require('./src/config/database');
async function run() {
  const res1 = await query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'dialer_sales'");
  const res2 = await query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'dialer_sales_history'");
  console.log('dialer_sales:', res1.rows.map(r => r.column_name).join(', '));
  console.log('dialer_sales_history:', res2.rows.map(r => r.column_name).join(', '));
  process.exit(0);
}
run();
