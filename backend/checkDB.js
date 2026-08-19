const { query } = require('./src/config/database');
query("SELECT id, total_uploaded, total_found, not_found, compare_date FROM compare_history ORDER BY id DESC LIMIT 5")
  .then(res => { console.log(res.rows); process.exit(0); })
  .catch(err => { console.error(err); process.exit(1); });
