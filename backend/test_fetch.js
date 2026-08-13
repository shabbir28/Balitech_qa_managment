const { fetchAdminPage } = require('./src/controllers/dialerController');
const fs = require('fs');

async function test() {
  try {
    const html = await fetchAdminPage('admin.php?ADD=32', 'pharmacy');
    fs.writeFileSync('test_add32.html', html);
    console.log('Saved to test_add32.html. Length:', html.length);
    
    // Let's just manually search for row elements and log what we find
    const rows = html.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi);
    if (!rows) {
      console.log('No rows found');
      return;
    }
    
    let saleYCount = 0;
    
    rows.forEach((row, i) => {
      // Check if this row is a status row
      if (row.includes('admin.php?ADD=4&status=') || row.includes('ADD=4')) {
        const cols = row.match(/<td[^>]*>([\s\S]*?)<\/td>/gi);
        if (cols && cols.length >= 5) {
          const clean = (str) => str.replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, ' ').trim().replace(/\s+/g, ' ');
          const status = clean(cols[0]);
          const saleCol = clean(cols[4]);
          console.log(`[ADD=32 Row ${i}] Status: ${status} | SaleCol: ${saleCol}`);
          if (saleCol === 'Y') saleYCount++;
        } else {
          console.log(`[ADD=32 Row ${i}] Found ADD=4 but columns not parsed correctly. Cols length: ${cols ? cols.length : 0}`);
        }
      }
    });
    console.log(`Total System statuses with Sale=Y: ${saleYCount}`);

    // Now test ADD=34 campaign 001
    const cHtml = await fetchAdminPage('admin.php?ADD=34&campaign_id=001&custom_report_1=1', 'pharmacy');
    fs.writeFileSync('test_add34.html', cHtml);
    const cRows = cHtml.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi);
    if(cRows) {
      cRows.forEach((row, i) => {
        if(row.includes('admin.php?ADD=35&campaign_id=')) {
          const cols = row.match(/<td[^>]*>([\s\S]*?)<\/td>/gi);
          if (cols && cols.length >= 5) {
            const clean = (str) => str.replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, ' ').trim().replace(/\s+/g, ' ');
            console.log(`[ADD=34 Row ${i}] Status: ${clean(cols[0])} | SaleCol: ${clean(cols[4])}`);
          }
        }
      });
    }

  } catch (err) {
    console.error(err);
  }
}

test();
