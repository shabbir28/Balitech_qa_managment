const { fetchAdminPage } = require('./src/controllers/dialerController');
const { getSales } = require('./src/controllers/dialerSalesController');

async function checkAll() {
  const html = await fetchAdminPage('admin.php?ADD=10', 'pharmacy');
  const campRows = html.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi);
  const campaigns = new Set();
  if (campRows) {
    for (const row of campRows) {
      if (row.includes('campaign_id=')) {
        const match = row.match(/campaign_id=([^"'>&\s]+)/);
        if (match) campaigns.add(match[1]);
      }
    }
  }
  
  console.log('Campaigns found:', [...campaigns]);
  let totalY = 0;

  for (let c of campaigns) {
    const cHtml = await fetchAdminPage(`admin.php?ADD=34&campaign_id=${c}&custom_report_1=1`, 'pharmacy');
    const selects = cHtml.match(/name=["']?sale["']?[\s\S]*?<\/select>/gi);
    if (selects) {
      const yes = selects.filter(s => /<option[^>]*value=['"]Y['"][^>]*selected/i.test(s) || s.includes("value='Y' selected") || s.includes('value="Y" selected'));
      if (yes.length > 0) {
        console.log(`Campaign ${c} has ${yes.length} Sale=Y statuses.`);
        totalY += yes.length;
      }
    }
  }

  console.log('Total Sale=Y statuses across all campaigns:', totalY);
  
  // Now let's see if there is ANY page with system statuses
  // Let's check admin.php?ADD=311111 or something
}

checkAll().catch(console.error);
