require('dotenv').config();
const { fetchAdminPage } = require('./src/controllers/dialerController');

async function getSaleStatuses(dialerType) {
  const statuses = new Set();
  
  // 1. Fetch system statuses
  const sysHtml = await fetchAdminPage('admin.php?ADD=3', dialerType);
  parseStatusesHtml(sysHtml, statuses);

  // 2. Fetch campaigns list
  const campHtml = await fetchAdminPage('admin.php?ADD=10', dialerType);
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

  // 3. Fetch each campaign's statuses
  for (const campaignId of campaigns) {
    try {
      const cStatHtml = await fetchAdminPage(`admin.php?ADD=34&campaign_id=${campaignId}`, dialerType);
      parseStatusesHtml(cStatHtml, statuses);
    } catch (err) {
      console.error(`Failed to fetch statuses for campaign ${campaignId} on ${dialerType}`);
    }
  }

  return [...statuses];
}

function parseStatusesHtml(html, statusSet) {
  const rows = html.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi);
  if (!rows) return;
  for (const row of rows) {
    if (row.includes('admin.php?ADD=4&status=') || row.includes('admin.php?ADD=35&campaign_id=')) {
      const cols = row.match(/<td[^>]*>([\s\S]*?)<\/td>/gi);
      if (cols && cols.length >= 6) {
        const clean = (str) => str.replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, ' ').trim().replace(/\s+/g, ' ');
        const status = clean(cols[0]);
        let isSale = false;
        
        if (clean(cols[4]) === 'Y' || status.toUpperCase().includes('SALE')) {
          isSale = true;
          console.log(`Found Sale Status: ${status}`);
        }

        if (isSale && status) {
          statusSet.add(status);
        }
      }
    }
  }
}

async function run() {
  console.log('Testing getSaleStatuses pharmacy...');
  const res = await getSaleStatuses('pharmacy');
  console.log('Final array:', res);
}

run();
