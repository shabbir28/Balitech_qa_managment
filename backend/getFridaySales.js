const { backfillSales } = require('./src/controllers/dialerSalesController');
require('dotenv').config();

async function run() {
  const req = {
    body: {
      dialer: 'medicare',
      startDate: '2026-08-21',
      endDate: '2026-08-21'
    }
  };
  const res = {
    json: (data) => console.log('Response JSON:', data),
    status: (code) => ({
      json: (data) => console.log(`Status ${code} JSON:`, data)
    })
  };
  console.log("Starting fetch for medicare for Friday (2026-08-21)...");
  await backfillSales(req, res);
  
  console.log("Done.");
  process.exit(0);
}
run();
