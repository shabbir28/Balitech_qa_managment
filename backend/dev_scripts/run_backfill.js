const { backfillSales } = require('../src/controllers/dialerSalesController');
const { query } = require('../config/database');

async function main() {
  const req = {
    body: {
      dialer: 'medicare',
      startDate: '2026-08-19',
      endDate: '2026-08-19'
    }
  };
  const res = {
    status: (code) => ({ json: (data) => console.log('Response:', code, data) })
  };
  await backfillSales(req, res);
  
  const countRes = await query("SELECT COUNT(*) FROM dialer_sales_history WHERE dialer='medicare' AND sale_date='2026-08-19'");
  console.log('New DB Count:', countRes.rows[0].count);
  process.exit(0);
}
main();
