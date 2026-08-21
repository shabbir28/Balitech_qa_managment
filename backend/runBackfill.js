const { backfillSales } = require('./src/controllers/dialerSalesController');
require('dotenv').config();

async function run() {
  const req = {
    body: {
      dialer: 'medicare',
      startDate: '2026-08-03',
      endDate: '2026-08-11'
    }
  };
  const res = {
    json: (data) => console.log('Response JSON:', data),
    status: (code) => ({
      json: (data) => console.log(`Status ${code} JSON:`, data)
    })
  };
  console.log("Starting backfill for medicare...");
  await backfillSales(req, res);
  
  req.body.dialer = 'pharmacy';
  console.log("Starting backfill for pharmacy...");
  await backfillSales(req, res);
  
  console.log("Done.");
  process.exit(0);
}
run();
