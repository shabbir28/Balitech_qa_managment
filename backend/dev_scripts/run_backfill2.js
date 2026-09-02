const { backfillSales } = require('../src/controllers/dialerSalesController');
const { query } = require('../src/config/database');

async function main() {
  const req = {
    body: {
      dialer: 'medicare',
      startDate: '2026-08-19',
      endDate: '2026-08-19'
    }
  };
  const res = {
    status: (code) => {
      console.log('Status:', code);
      return {
        json: (data) => console.log('JSON:', data.success ? data.data.length + ' leads returned' : data)
      };
    },
    json: (data) => console.log('JSON:', data.success ? data.data.length + ' leads returned' : data)
  };
  console.log('Starting backfill for 2026-08-19');
  await backfillSales(req, res);
  
  setTimeout(async () => {
    const countRes = await query("SELECT status, COUNT(*) FROM dialer_sales_history WHERE dialer='medicare' AND sale_date='2026-08-19' GROUP BY status");
    console.log('New DB Counts:');
    let total = 0;
    countRes.rows.forEach(r => {
      console.log(r.status, r.count);
      total += parseInt(r.count);
    });
    console.log('TOTAL:', total);
    process.exit(0);
  }, 10000); // Wait 10 seconds for background inserts
}
main();
