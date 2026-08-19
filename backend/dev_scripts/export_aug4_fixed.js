const fs = require('fs');
const { query } = require('./src/config/database');

async function run() {
  try {
    const res = await query("SELECT phone, status, agent, team, sale_date, dialer FROM dialer_sales_history");
    
    let csv = 'Phone,Status,Agent,Team,Sale Date,Dialer\n';
    let count = 0;
    res.rows.forEach(row => {
      // Replicate the exact grouping logic of the UI
      const dateStr = row.sale_date instanceof Date ? row.sale_date.toISOString().split('T')[0] : String(row.sale_date).split('T')[0];
      if (dateStr === '2026-08-04') {
        csv += `${row.phone},${row.status},${row.agent},${row.team},${dateStr},${row.dialer}\n`;
        count++;
      }
    });
    
    fs.writeFileSync('C:/Users/Admin-BT/.gemini/antigravity-ide/brain/0c03d867-e907-48eb-9de9-a952d643bb48/scratch/aug4_dialer_sales_fixed.csv', csv);
    console.log('Saved ' + count + ' records to aug4_dialer_sales_fixed.csv');
  } catch (err) {
    console.error(err);
  }
  process.exit(0);
}
run();
