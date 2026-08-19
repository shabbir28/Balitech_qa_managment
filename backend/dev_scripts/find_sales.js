const { fetchAdminPage } = require('./src/controllers/dialerController');

async function findSales() {
  const html = await fetchAdminPage('admin.php?ADD=3111&campaign_id=001', 'medicare', 'GET');
  const salesStatuses = [];
  
  const rows = html.split('<tr');
  for (const row of rows) {
    if (row.includes('Y') && row.includes('td')) {
      const tds = row.split('<td');
      if (tds.length >= 6) {
        // extract text from td
        const getTdText = (tdHtml) => {
          const match = tdHtml.match(/>([^<]+)<\//);
          return match ? match[1].trim() : '';
        };
        const status = getTdText(tds[1]); // tds[0] is empty before first <td
        const isSale = getTdText(tds[4]);
        
        if (isSale === 'Y' && status) {
          salesStatuses.push(status);
        }
      }
    }
  }
  
  console.log('SALE STATUSES FROM CAMPAIGN:', salesStatuses);
}
findSales();
