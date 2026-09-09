const cron = require('node-cron');
const { expireStaleAssignments } = require('../controllers/teamController');

const initAssignmentExpirationCron = () => {
  // 1. Run immediately on server boot
  expireStaleAssignments().then(count => {
    if (count > 0) {
      console.log(`🧹 [Startup] Auto-expired ${count} uncompleted assignment(s) from previous days.`);
    }
  }).catch(err => {
    console.error('❌ Error during startup assignment expiration:', err.message);
  });

  // 2. Schedule to run at 00:01 AM every day in America/New_York
  cron.schedule('1 0 * * *', async () => {
    console.log('\n⏰ [Midnight Cron] Checking and expiring stale assignments for the new day...');
    try {
      const count = await expireStaleAssignments();
      console.log(`✅ [Midnight Cron] Expiration completed. Expired ${count} assignment(s).\n`);
    } catch (err) {
      console.error('❌ [Midnight Cron] Error expiring stale assignments:', err.message);
    }
  }, {
    timezone: 'America/New_York'
  });

  // 3. Safeguard: check periodically (every 30 minutes) in case server was restarted or clock shifted
  cron.schedule('*/30 * * * *', async () => {
    try {
      await expireStaleAssignments();
    } catch (err) {
      console.error('❌ [Periodic] Error expiring stale assignments:', err.message);
    }
  });

  console.log('📅 Scheduled daily assignment expiration at 00:01 (America/New_York) and every 30m');
};

module.exports = initAssignmentExpirationCron;
