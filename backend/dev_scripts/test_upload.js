const { parseFile, normalizeRow } = require('./src/controllers/callController');
const fs = require('fs');

async function test() {
  fs.writeFileSync('test_upload.txt', '123456\n789012\n345678\n');
  const rows = await parseFile('test_upload.txt');
  console.log('Parsed rows:', rows.length);
  
  let validPhones = 0;
  for (const row of rows) {
    const norm = normalizeRow(row);
    let phone = norm.customer_phone || Object.values(row)[0] || '';
    if (!phone || !String(phone).trim()) continue;
    validPhones++;
  }
  console.log('Valid phones:', validPhones);
}
test();
