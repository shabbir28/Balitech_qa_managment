const cron = require('node-cron');
const { backfillSales } = require('../controllers/dialerSalesController');

// Helper to mock Express req, res. The controller reports failures through
// res.status(4xx/5xx) rather than throwing, so the mock turns those into a
// rejected promise — otherwise the cron would log "completed successfully"
// after a failed pull.
const runSync = (dialer, dateStr) => new Promise((resolve, reject) => {
  const req = {
    body: {
      dialer: dialer,
      startDate: dateStr,
      endDate: dateStr
    }
  };

  let statusCode = 200;
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      if (statusCode >= 400) {
        console.error(`[Cron Sync ${dialer}] Status ${statusCode}:`, data);
        reject(new Error(`${dialer} sync failed with status ${statusCode}: ${data?.message || 'unknown error'}`));
      } else {
        console.log(`[Cron Sync ${dialer}] Success:`, data);
        resolve(data);
      }
    },
  };

  Promise.resolve(backfillSales(req, res)).catch(reject);
});

const initSalesSyncCron = () => {
  // Run at 11:55 PM every day
  cron.schedule('55 23 * * *', async () => {
    console.log('\n⏰ Running daily sales sync cron job...');
    
    // Get today's date in America/New_York (YYYY-MM-DD)
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const todayStr = formatter.format(new Date());

    console.log(`Starting sync for date: ${todayStr}`);
    
    // Sequential to keep dialer load flat, but one dialer failing must not skip the other.
    const failures = [];
    for (const dialer of ['medicare', 'pharmacy']) {
      try {
        await runSync(dialer, todayStr);
      } catch (err) {
        failures.push(dialer);
        console.error('❌ Daily sales sync error:', err?.message || err);
      }
    }
    if (failures.length) {
      console.error(`❌ Daily sales sync finished with failures: ${failures.join(', ')}\n`);
    } else {
      console.log('✅ Daily sales sync completed successfully.\n');
    }
  }, {
    timezone: "America/New_York"
  });
  
  console.log('📅 Scheduled daily sales sync for 11:55 PM (America/New_York)');
};

module.exports = initSalesSyncCron;
