const { query } = require('./src/config/database');
async function run() {
  await query('TRUNCATE TABLE campaigns CASCADE');
  await query("INSERT INTO campaigns (name, description, passing_score) VALUES ('ACA', 'ACA Campaign', 80), ('Medicare', 'Medicare Campaign', 80), ('FE', 'FE Campaign', 80), ('Med Alert', 'Med Alert Campaign', 80)");
  console.log('Done');
  process.exit(0);
}
run().catch(console.error);
