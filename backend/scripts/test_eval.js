const { query, pool } = require('../src/config/database');

async function test() {
  try {
    const res = await query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'qa_evaluations'`);
    console.log(res.rows.map(r => r.column_name));
    
    // Also test getEvaluations manually
    const userRole = 'Manager'; // Assuming manager
    const limit = 20;
    const offset = 0;
    const where = 'WHERE qe.is_deleted = FALSE';
    
    const countResult = await query(`SELECT COUNT(*) FROM qa_evaluations qe ${where}`, []);
    console.log('Count:', countResult.rows[0].count);
    
    const params = [limit, offset];
    const result = await query(
      `SELECT qe.*, u.name as evaluator_name
       FROM qa_evaluations qe
       JOIN users u ON qe.evaluated_by = u.id
       ${where}
       ORDER BY qe.created_at DESC
       LIMIT $1 OFFSET $2`,
      params
    );
    console.log('Rows:', result.rows.length);
  } catch (err) {
    console.error('ERROR:', err.message);
  } finally {
    pool.end();
  }
}

test();
