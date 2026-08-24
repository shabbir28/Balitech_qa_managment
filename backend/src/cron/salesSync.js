const cron = require('node-cron');
const { backfillSales } = require('../controllers/dialerSalesController');

// Helper to mock Express req, res
const runSync = async (dialer, dateStr) => {
  const req = {
    body: {
      dialer: dialer,
      startDate: dateStr,
      endDate: dateStr
    }
  };
  
  const res = {
    status: (code) => {
      return {
        json: (data) => console.log(`[Cron Sync ${dialer}] Status ${code}:`, data)
      };
    },
    json: (data) => console.log(`[Cron Sync ${dialer}] Success:`, data)
  };

  await backfillSales(req, res);
};

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
    
    try {
      await runSync('medicare', todayStr);
      await runSync('pharmacy', todayStr);
      console.log('✅ Daily sales sync completed successfully.\n');
    } catch (err) {
      console.error('❌ Error during daily sales sync:', err);
    }
  }, {
    timezone: "America/New_York"
  });
  
  console.log('📅 Scheduled daily sales sync for 11:55 PM (America/New_York)');
};

module.exports = initSalesSyncCron;
