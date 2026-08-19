const fs = require('fs');
const { parseStatusesHtml } = require('./src/controllers/dialerSalesController');
const html = fs.readFileSync('test_statuses_page.html', 'utf8');
const statusSet = new Set();
// We copied parseStatusesHtml from the file just in case it wasn't exported.
function testParse(html, statusSet) {
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
          const cleanStr = tdHtml.replace(/<[^>]*>/g, '').trim();
          return cleanStr;
        };

        const val4 = getSelectedVal(cols[4]);
        const val5 = getSelectedVal(cols[5]);
        
        if (val4 === 'Y' || val5 === 'Y') {
          const saleSelectMatch = row.match(/name=["']?sale["']?[\s\S]*?<\/select>/i);
          if (saleSelectMatch) {
            const saleVal = getSelectedVal(saleSelectMatch[0]);
            if (saleVal === 'Y') {
              isSale = true;
            }
          } else {
             if (val4 === 'Y' || val5 === 'Y') isSale = true;
          }
        }

        if (isSale && status) {
          statusSet.add(status);
        }
      }
    }
  }
}
testParse(html, statusSet);
console.log('Parsed statuses:', [...statusSet]);
