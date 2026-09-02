const { fetchAdminPage } = require('../src/controllers/dialerController');
require('dotenv').config();

async function main() {
  const statuses = new Set();
  const campHtml = await fetchAdminPage('admin.php?ADD=10', 'medicare', 'GET');
  const campRows = campHtml.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi);
  const campaigns = new Set();
  if (campRows) {
    for (const row of campRows) {
      if (row.includes('campaign_id=')) {
        const match = row.match(/campaign_id=([^"'>&\s]+)/);
        if (match) campaigns.add(match[1]);
      }
    }
  }

  for (const campaignId of campaigns) {
    const cStatHtml = await fetchAdminPage(`admin.php?ADD=34&campaign_id=${campaignId}&custom_report_1=1`, 'medicare', 'GET');
    const rows = cStatHtml.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi);
    if (!rows) continue;
    for (const row of rows) {
      const statusMatch = row.match(/name=status\s+value=["']([^"']+)["']/i) || row.match(/status=([^"'>&\s]+)/i);
      if (statusMatch) {
        statuses.add(statusMatch[1]);
      }
    }
  }
  
  const sysHtml = await fetchAdminPage('admin.php?ADD=321111111111111', 'medicare', 'GET');
  const rows = sysHtml.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi);
  if (rows) {
    for (const row of rows) {
      const statusMatch = row.match(/name=status\s+value=["']([^"']+)["']/i) || row.match(/status=([^"'>&\s]+)/i);
      if (statusMatch) statuses.add(statusMatch[1]);
    }
  }

  console.log('ALL possible statuses:', [...statuses]);
}
main();
