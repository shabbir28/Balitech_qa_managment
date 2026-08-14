const { query } = require('./src/config/database');

async function run() {
  const res = await query('SELECT id, compare_date, result_data FROM compare_history ORDER BY id DESC LIMIT 1');
  const record = res.rows[0];
  const results = typeof record.result_data === 'string' ? JSON.parse(record.result_data) : record.result_data;
  const foundPhones = results.filter(r => r.status !== 'Not Found').map(r => r.phone);
  
  if (foundPhones.length === 0) {
    console.log("No found phones in the record.");
    process.exit(0);
  }

  const placeholders = foundPhones.map((_,i) => '$'+(i+1)).join(',');
  const sql = `SELECT phone, sale_date, agent, team, status FROM dialer_sales_history WHERE phone IN (${placeholders})`;
  const sales = await query(sql, foundPhones);
  
  const compareDateStr = record.compare_date.toISOString().split('T')[0];
  
  const backfilled = sales.rows.filter(s => {
    const dStr = s.sale_date.toISOString().split('T')[0];
    return dStr !== compareDateStr;
  });
  
  console.log('Compare Date:', compareDateStr);
  console.log('Backfilled Phones:', JSON.stringify(backfilled, null, 2));
  process.exit(0);
}
run();
