const { query } = require('./src/config/database');
query("SELECT status, COUNT(*) FROM dialer_sales_history WHERE sale_date BETWEEN '2026-08-01' AND '2026-08-11' GROUP BY status")
  .then(res => { console.table(res.rows); process.exit(0); })
  .catch(err => { console.error(err); process.exit(1); });
