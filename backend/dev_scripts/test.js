const { query } = require('./src/config/database');
query(`
      SELECT u.id, u.name, u.email, u.role_id, r.name as role, u.department, u.agent_id,
        COUNT(DISTINCT la.id) as total_assigned,
        COUNT(DISTINCT CASE WHEN la.status = 'pending' THEN la.id END) as pending,
        COUNT(DISTINCT CASE WHEN e.status = 'Pass' THEN e.id END) as accepted,
        COUNT(DISTINCT CASE WHEN e.status = 'Fail' THEN e.id END) as rejected,
        COUNT(DISTINCT CASE WHEN la.status = 'completed' THEN la.id END) as completed
      FROM users u
      JOIN roles r ON u.role_id = r.id
      JOIN lead_assignments la ON u.id = la.assigned_to
      LEFT JOIN qa_evaluations e ON e.call_lead_id = la.call_lead_id AND e.evaluator_id = u.id
      WHERE la.assigned_by = 1 AND u.deleted_at IS NULL
      GROUP BY u.id, r.name
      ORDER BY u.name
`).then(res => console.log('OK', res.rows)).catch(err => console.error('ERR', err.message));
