const { query, pool } = require('../src/config/database');

async function inspect() {
  try {
    const res = await query(`
      SELECT qe.id, qe.call_lead_id, qe.agent_id, u.name as evaluator_name, qe.status, qe.evaluation_date, qe.created_at, qe.metadata->>'qa_status' as qa_status, cl.agent_name
      FROM qa_evaluations qe
      LEFT JOIN users u ON qe.evaluated_by = u.id
      LEFT JOIN call_leads cl ON qe.call_lead_id = cl.id
      ORDER BY qe.id
    `);
    console.log('ALL EVALUATIONS:');
    console.table(res.rows);

    const assignments = await query(`
      SELECT la.id, la.call_lead_id, u.name as qa_user_name, la.status, la.assigned_at
      FROM lead_assignments la
      JOIN users u ON la.user_id = u.id
      ORDER BY la.id DESC
      LIMIT 10
    `);
    console.log('LEAD ASSIGNMENTS (sample):');
    console.table(assignments.rows);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

inspect();
