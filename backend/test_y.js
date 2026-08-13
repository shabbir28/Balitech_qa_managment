const fs = require('fs');
const html = fs.readFileSync('test_statuses_page.html', 'utf8');
const selects = html.match(/name=["']?sale["']?[\s\S]*?<\/select>/gi);
if (selects) {
  console.log('Total sale dropdowns:', selects.length);
  const yesSales = selects.filter(s => /<option[^>]*value=['"]Y['"][^>]*selected/i.test(s) || s.includes("value='Y' selected") || s.includes('value="Y" selected'));
  console.log('Total Y:', yesSales.length);
  console.log(yesSales);
}
