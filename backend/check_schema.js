const { query } = require('./src/config/database');
async function run() {
  const res = await query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'dialer_sales_history' AND column_name = 'sale_date'");
  console.log(res.rows);
  process.exit(0);
}
run();
