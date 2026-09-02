require('dotenv').config();
const { fetchAdminPage } = require('./src/controllers/dialerController');

async function testStatuses() {
  try {
    const dialer = 'medicare';
    const html1 = await fetchAdminPage('admin.php?ADD=321111111', dialer, 'GET');
    
    const statuses = new Set();
    const rows = html1.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi);
    if (rows) {
      for (const row of rows) {
        const statusMatch = row.match(/status=([^"'>&\s]+)/i) || row.match(/name=status\s+value=["']([^"']+)["']/i);
        if (statusMatch) statuses.add(statusMatch[1]);
      }
    }
    
    // Also get all campaigns to find their custom statuses
    const campHtml = await fetchAdminPage('admin.php?ADD=10', dialer, 'GET');
    const campRows = campHtml.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi);
    const campaigns = new Set();
    if (campRows) {
      for (const row of campRows) {
        const match = row.match(/campaign_id=([^"'>&\s]+)/);
        if (match) campaigns.add(match[1]);
      }
    }
    
    for (const campaignId of campaigns) {
      const cStatHtml = await fetchAdminPage(`admin.php?ADD=34&campaign_id=${campaignId}&custom_report_1=1`, dialer, 'GET');
      const cRows = cStatHtml.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi);
      if (cRows) {
        for (const row of cRows) {
          const statusMatch = row.match(/status=([^"'>&\s]+)/i) || row.match(/name=status\s+value=["']([^"']+)["']/i);
          if (statusMatch) statuses.add(statusMatch[1]);
        }
      }
    }
    
    console.log('ALL AVAILABLE STATUSES IN SYSTEM:');
    console.log([...statuses].sort());
  } catch (err) {
    console.error(err);
  }
}
testStatuses();
