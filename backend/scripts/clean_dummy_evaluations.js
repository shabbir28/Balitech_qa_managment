const { query, pool } = require('../src/config/database');

async function cleanDummyData() {
  try {
    // 1. Check which evaluations exist
    const before = await query(`
      SELECT qe.id, u.name as evaluator_name, cl.agent_name, qe.status, qe.evaluation_date
      FROM qa_evaluations qe
      LEFT JOIN users u ON qe.evaluated_by = u.id
      LEFT JOIN call_leads cl ON qe.call_lead_id = cl.id
      ORDER BY qe.id
    `);
    console.log('Evaluations before clean:', before.rows.length);

    // Delete feedback associated with dummy evaluations (evaluated_by != david id or id < 11)
    const delFeedback = await query(`
      DELETE FROM feedback
      WHERE evaluation_id IN (
        SELECT id FROM qa_evaluations WHERE id < 11
      )
    `);
    console.log('Deleted feedback rows:', delFeedback.rowCount);

    // Delete evaluation_critical_errors associated with dummy evaluations
    const delErrors = await query(`
      DELETE FROM evaluation_critical_errors
      WHERE evaluation_id IN (
        SELECT id FROM qa_evaluations WHERE id < 11
      )
    `);
    console.log('Deleted evaluation_critical_errors rows:', delErrors.rowCount);

    // Delete dummy qa_evaluations
    const delEvals = await query(`
      DELETE FROM qa_evaluations
      WHERE id < 11
    `);
    console.log('Deleted dummy qa_evaluations rows:', delEvals.rowCount);

    // Remaining evaluations in DB
    const after = await query(`
      SELECT qe.id, u.name as evaluator_name, cl.agent_name, qe.status, qe.evaluation_date, qe.created_at
      FROM qa_evaluations qe
      LEFT JOIN users u ON qe.evaluated_by = u.id
      LEFT JOIN call_leads cl ON qe.call_lead_id = cl.id
      ORDER BY qe.id
    `);
    console.log('Remaining evaluations (David only):');
    console.table(after.rows);

  } catch (err) {
    console.error('Error cleaning dummy data:', err);
  } finally {
    await pool.end();
  }
}

cleanDummyData();
