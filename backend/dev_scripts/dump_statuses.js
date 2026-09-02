const { fetchAdminPage } = require('../src/controllers/dialerController');
require('dotenv').config();

async function main() {
  const campHtml = await fetchAdminPage('admin.php?ADD=10', 'medicare', 'GET');
  const campRows = campHtml.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi);
  let campId = null;
  if (campRows) {
    for (const row of campRows) {
      if (row.includes('campaign_id=')) {
        const match = row.match(/campaign_id=([^"'>&\s]+)/);
        if (match) { campId = match[1]; break; }
      }
    }
  }
  if (!campId) return;

  const cStatHtml = await fetchAdminPage(`admin.php?ADD=34&campaign_id=${campId}&custom_report_1=1`, 'medicare', 'GET');
  const rows = cStatHtml.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi);
  if (!rows) return;
  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const row = rows[i];
    if (row.includes('name=status')) {
      console.log('Row:', row);
    }
  }
}
main();
