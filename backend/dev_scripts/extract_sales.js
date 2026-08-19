const fs = require('fs');
const html = fs.readFileSync('campaign_statuses.html', 'utf8');

const rows = html.split('<tr');
const sales = [];

for (const row of rows) {
  if (row.includes('Y') && row.includes('td')) {
    const tds = row.split('<td');
    if (tds.length >= 6) {
      const getTdText = (tdHtml) => {
        const match = tdHtml.match(/>([^<]+)<\//);
        return match ? match[1].trim() : '';
      };
      const status = getTdText(tds[1]);
      const isSale = getTdText(tds[4]);
      
      if (isSale === 'Y' && status) {
        sales.push(status);
      }
    }
  }
}
console.log('SALE STATUSES:', sales);
