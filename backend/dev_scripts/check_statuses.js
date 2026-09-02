const { fetchAdminPage } = require('../src/controllers/dialerController');
require('dotenv').config();

async function getSaleStatuses(dialerType) {
  let statuses = new Set();
  try {
    const html1 = await fetchAdminPage('admin.php?ADD=34&campaign_id=TEST', dialerType, 'GET');
    parseStatusesHtml(html1, statuses);
    const html2 = await fetchAdminPage('admin.php?ADD=321111111', dialerType, 'GET');
    parseStatusesHtml(html2, statuses);
    return [...statuses];
  } catch (error) {
    console.error(error);
    return [];
  }
}

function parseStatusesHtml(html, statusSet) {
  const rows = html.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi);
  if (!rows) return;
  for (const row of rows) {
    const statusMatch = row.match(/name=status\s+value=["']([^"']+)["']/i) || row.match(/status=([^"'>&\s]+)/i);
    if (statusMatch) {
      const status = statusMatch[1];
      const cols = row.match(/<td[^>]*>([\s\S]*?)<\/td>/gi);
      if (cols && cols.length >= 6) {
        let isSale = false;
        const getSelectedVal = (tdHtml) => {
          const match = tdHtml.match(/<option[^>]*value=['"]([^'"]+)['"][^>]*selected/i);
          if (match) return match[1].toUpperCase();
          if (tdHtml.includes(">Y<")) return 'Y'; 
          return tdHtml.replace(/<[^>]*>/g, '').trim();
        };

        const val4 = getSelectedVal(cols[4]);
        const val5 = getSelectedVal(cols[5]);
        
        if (val4 === 'Y' || val5 === 'Y') {
          const saleSelectMatch = row.match(/name=["']?sale["']?[\s\S]*?<\/select>/i);
          if (saleSelectMatch) {
            const saleVal = getSelectedVal(saleSelectMatch[0]);
            if (saleVal === 'Y') isSale = true;
          } else {
             if (val4 === 'Y' || val5 === 'Y') isSale = true;
          }
        }
        if (isSale && status) statusSet.add(status);
      }
    }
  }
}

async function main() {
  const statuses = await getSaleStatuses('medicare');
  console.log('Parsed Medicare Sale Statuses:', statuses);
}
main();
