const html = require('fs').readFileSync('campaigns.html', 'utf8');
const campaigns = new Set();
const rows = html.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi);
if (rows) {
  for (const row of rows) {
    if (row.includes('admin.php?ADD=31&campaign_id=')) {
      const match = row.match(/campaign_id=([^"'>&]+)/);
      if (match) {
        campaigns.add(match[1]);
      }
    }
  }
}
console.log('Campaigns:', [...campaigns]);
