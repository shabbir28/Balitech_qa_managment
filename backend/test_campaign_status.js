const html = require('fs').readFileSync('campaign_statuses.html', 'utf8');

const statuses = [];
const rows = html.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi);
if (rows) {
  for (const row of rows) {
    if (row.includes('admin.php?ADD=35&campaign_id=')) {
      // This is a status row
      const cols = row.match(/<td[^>]*>([\s\S]*?)<\/td>/gi);
      if (cols && cols.length >= 6) {
        const clean = (str) => str.replace(/<[^>]*>/g, '').trim();
        const status = clean(cols[0]);
        // Looking at the screenshot, the columns for Campaign statuses are:
        // STATUS | DESCRIPTION | CATEGORY | ... | MIN SEC | MAX SEC | MODIFY/DELETE
        // Wait, where is Sale=Y? 
        // In the screenshot, the headers are vertical: AGENT SELECTABLE, HUMAN ANSWER, SALE, DNC, CUSTOMER CONTACT, etc.
        // There are many columns!
        // Let's print out all cleaned columns.
        console.log(cols.map(clean));
      }
    }
  }
}
