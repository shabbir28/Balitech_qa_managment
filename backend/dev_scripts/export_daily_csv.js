const fs = require('fs');
const { query } = require('./src/config/database');

async function run() {
  try {
    const dates = [
      '2026-08-03', '2026-08-04', '2026-08-05',
      '2026-08-06', '2026-08-07', '2026-08-08',
      '2026-08-09', '2026-08-10', '2026-08-11'
    ];

    for (const dateStr of dates) {
      const res = await query(
        `SELECT phone, status, agent, team, sale_date, dialer 
         FROM dialer_sales_history 
         WHERE sale_date = $1`,
        [dateStr]
      );
      
      let csv = 'Phone,Status,Agent,Team,Sale Date,Dialer\n';
      res.rows.forEach(row => {
        // Since we patched the DATE parser, sale_date should be a string directly, but fallback just in case
        const saleDateStr = row.sale_date instanceof Date ? row.sale_date.toISOString().split('T')[0] : String(row.sale_date).split('T')[0];
        csv += `${row.phone},${row.status},${row.agent},${row.team},${saleDateStr},${row.dialer}\n`;
      });
      
      const filePath = `C:/Users/Admin-BT/.gemini/antigravity-ide/brain/0c03d867-e907-48eb-9de9-a952d643bb48/scratch/dialer_sales_${dateStr}.csv`;
      fs.writeFileSync(filePath, csv);
      console.log(`Saved ${res.rows.length} records to dialer_sales_${dateStr}.csv`);
    }
  } catch (err) {
    console.error(err);
  }
  process.exit(0);
}
run();
