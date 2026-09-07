const { pool } = require('../src/config/database');
async function run() {
  const client = await pool.connect();
  try {
    const res = await client.query("SELECT conname, pg_get_constraintdef(c.oid) FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace WHERE conrelid = 'call_leads'::regclass;");
    console.log('Constraints on call_leads:');
    res.rows.forEach(r => console.log(r));
    
    const cols = await client.query("SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'call_leads';");
    const qCols = await client.query("SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'qa_evaluations';");
    console.log('\nColumns in call_leads:');
    cols.rows.forEach(r => console.log(r.column_name));
    console.log('\nColumns in qa_evaluations:');
    qCols.rows.forEach(r => console.log(r));

    const qCons = await client.query("SELECT conname, pg_get_constraintdef(c.oid) FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace WHERE conrelid = 'qa_evaluations'::regclass;");
    console.log('\nConstraints on qa_evaluations:');
    qCons.rows.forEach(r => console.log(r));
  } catch (e) { console.error(e); }
  finally { client.release(); process.exit(); }
}
run();
