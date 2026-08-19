const { query } = require('./src/config/database');
query("SELECT id, name, email, campaign_id FROM users ORDER BY id DESC LIMIT 5").then(res => { console.table(res.rows); process.exit(0); }).catch(console.error);
