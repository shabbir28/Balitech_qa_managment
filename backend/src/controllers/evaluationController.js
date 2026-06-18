const { query, getClient } = require('../config/database');

/**
 * Calculate total score from individual scores
 */
const calculateTotalScore = (scores) => {
  const { opening_script_score, verification_score, product_knowledge_score,
    compliance_score, communication_score, closing_score, call_handling_score } = scores;
  const total = [
    opening_script_score, verification_score, product_knowledge_score,
    compliance_score, communication_score, closing_score, call_handling_score
  ].reduce((sum, s) => sum + (parseFloat(s) || 0), 0);
  return parseFloat((total / 7).toFixed(2));
};

/**
 * POST /api/evaluations
 */
const createEvaluation = async (req, res, next) => {
  const client = await getClient();
  try {
    const {
      call_lead_id,
      opening_script_score, verification_score, product_knowledge_score,
      compliance_score, communication_score, closing_score, call_handling_score,
      qa_remarks, evaluation_date, critical_errors = [],
    } = req.body;

    if (!call_lead_id) {
      return res.status(400).json({ success: false, message: 'call_lead_id is required.' });
    }

    // Fetch call lead
    const callResult = await query(
      'SELECT cl.*, c.passing_score FROM call_leads cl LEFT JOIN campaigns c ON cl.campaign_id = c.id WHERE cl.id = $1 AND cl.is_deleted = FALSE',
      [call_lead_id]
    );

    if (callResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Call/lead not found.' });
    }

    const call = callResult.rows[0];

    // Check already evaluated
    const alreadyEval = await query(
      'SELECT id FROM qa_evaluations WHERE call_lead_id = $1 AND is_deleted = FALSE',
      [call_lead_id]
    );
    if (alreadyEval.rows.length > 0) {
      return res.status(409).json({ success: false, message: 'This call has already been evaluated.' });
    }

    const total_score = calculateTotalScore({
      opening_script_score, verification_score, product_knowledge_score,
      compliance_score, communication_score, closing_score, call_handling_score,
    });

    const passing_score = call.passing_score || 75;
    const has_critical_error = critical_errors.length > 0;
    const finalStatus = req.body.status || ((has_critical_error || total_score < passing_score) ? 'Fail' : 'Pass');

    if (has_critical_error && (!qa_remarks || qa_remarks.trim() === '')) {
      return res.status(400).json({ success: false, message: 'QA remarks are required when critical errors are selected.' });
    }

    await client.query('BEGIN');

    const evalResult = await client.query(
      `INSERT INTO qa_evaluations (
        call_lead_id, agent_name, agent_id, campaign_name, campaign_id, recording_url,
        opening_script_score, verification_score, product_knowledge_score,
        compliance_score, communication_score, closing_score, call_handling_score,
        total_score, passing_score, status, has_critical_error, qa_remarks,
        evaluation_date, evaluated_by, metadata
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
      RETURNING *`,
      [
        call_lead_id, call.agent_name, call.agent_id, call.campaign_name, call.campaign_id,
        call.recording_url,
        parseFloat(opening_script_score) || 0,
        parseFloat(verification_score) || 0,
        parseFloat(product_knowledge_score) || 0,
        parseFloat(compliance_score) || 0,
        parseFloat(communication_score) || 0,
        parseFloat(closing_score) || 0,
        parseFloat(call_handling_score) || 0,
        total_score, passing_score, finalStatus, has_critical_error, qa_remarks,
        evaluation_date || new Date().toISOString().split('T')[0],
        req.user.id,
        req.body.metadata ? JSON.stringify(req.body.metadata) : null
      ]
    );

    const evaluation = evalResult.rows[0];

    // Insert critical errors
    for (const ce of critical_errors) {
      await client.query(
        `INSERT INTO evaluation_critical_errors (evaluation_id, critical_error_id, error_type, error_description, timestamp_in_recording, severity)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [evaluation.id, ce.critical_error_id, ce.error_type, ce.error_description || '', ce.timestamp_in_recording || '', ce.severity || 'High']
      );
    }

    // Mark call as evaluated
    await client.query('UPDATE call_leads SET is_evaluated = TRUE, updated_at = NOW() WHERE id = $1', [call_lead_id]);

    // Mark assignment as completed (if exists)
    await client.query(`
      UPDATE lead_assignments 
      SET status = 'completed', completed_at = NOW() 
      WHERE call_lead_id = $1 AND assigned_to = $2 AND status != 'completed'
    `, [call_lead_id, req.user.id]);

    // Find agent user id
    const agentUser = await client.query(
      'SELECT id FROM users WHERE agent_id = $1 AND deleted_at IS NULL LIMIT 1',
      [call.agent_id]
    );
    const agentUserId = agentUser.rows.length > 0 ? agentUser.rows[0].id : null;

    // Auto-generate feedback
    await client.query(
      `INSERT INTO feedback (evaluation_id, agent_name, agent_id, agent_user_id, campaign_name, qa_score, status, has_critical_errors, qa_remarks, feedback_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'Pending')`,
      [
        evaluation.id, call.agent_name, call.agent_id, agentUserId,
        call.campaign_name, total_score, finalStatus, has_critical_error, qa_remarks,
      ]
    );

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: 'Evaluation created successfully.',
      data: evaluation,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
};

/**
 * GET /api/evaluations
 */
const getEvaluations = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, agent_id, campaign_name, status, from_date, to_date, search } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const conditions = ['qe.is_deleted = FALSE'];
    const params = [];
    let pc = 1;

    // QA users see only evaluations they performed
    if (req.user.role === 'User') {
      conditions.push(`qe.evaluated_by = $${pc}`);
      params.push(req.user.id);
      pc++;
    }

    if (search) {
      conditions.push(`(qe.agent_name ILIKE $${pc} OR qe.campaign_name ILIKE $${pc})`);
      params.push(`%${search}%`);
      pc++;
    }
    if (agent_id) { conditions.push(`qe.agent_id = $${pc}`); params.push(agent_id); pc++; }
    if (campaign_name) { conditions.push(`qe.campaign_name ILIKE $${pc}`); params.push(`%${campaign_name}%`); pc++; }
    if (status) { conditions.push(`qe.status = $${pc}`); params.push(status); pc++; }
    if (from_date) { conditions.push(`qe.evaluation_date >= $${pc}`); params.push(from_date); pc++; }
    if (to_date) { conditions.push(`qe.evaluation_date <= $${pc}`); params.push(to_date); pc++; }

    const where = 'WHERE ' + conditions.join(' AND ');
    const countResult = await query(`SELECT COUNT(*) FROM qa_evaluations qe ${where}`, params);
    const total = parseInt(countResult.rows[0].count);

    params.push(parseInt(limit)); params.push(offset);

    const result = await query(
      `SELECT qe.*, u.name as evaluator_name
       FROM qa_evaluations qe
       JOIN users u ON qe.evaluated_by = u.id
       ${where}
       ORDER BY qe.created_at DESC
       LIMIT $${pc} OFFSET $${pc + 1}`,
      params
    );

    res.json({
      success: true,
      data: result.rows,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (error) {
    console.error("GET EVALUATIONS ERROR:", error);
    res.status(500).json({ success: false, message: error.message, stack: error.stack });
  }
};

/**
 * GET /api/evaluations/:id
 */
const getEvaluationById = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT qe.*, u.name as evaluator_name
       FROM qa_evaluations qe
       JOIN users u ON qe.evaluated_by = u.id
       WHERE qe.id = $1 AND qe.is_deleted = FALSE`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Evaluation not found.' });
    }

    const evaluation = result.rows[0];

    // Get critical errors
    const errors = await query(
      'SELECT * FROM evaluation_critical_errors WHERE evaluation_id = $1',
      [evaluation.id]
    );

    evaluation.critical_errors = errors.rows;

    res.json({ success: true, data: evaluation });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/evaluations/:id
 */
const updateEvaluation = async (req, res, next) => {
  try {
    const {
      opening_script_score, verification_score, product_knowledge_score,
      compliance_score, communication_score, closing_score, call_handling_score,
      qa_remarks, evaluation_date,
    } = req.body;

    const total_score = calculateTotalScore({
      opening_script_score, verification_score, product_knowledge_score,
      compliance_score, communication_score, closing_score, call_handling_score,
    });

    // Get passing score
    const existing = await query('SELECT passing_score FROM qa_evaluations WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Evaluation not found.' });
    }

    const passing_score = existing.rows[0].passing_score;
    const status = req.body.status || (total_score < passing_score ? 'Fail' : 'Pass');

    const result = await query(
      `UPDATE qa_evaluations SET
        opening_script_score=$1, verification_score=$2, product_knowledge_score=$3,
        compliance_score=$4, communication_score=$5, closing_score=$6, call_handling_score=$7,
        total_score=$8, status=$9, qa_remarks=$10, evaluation_date=$11, metadata=$12, updated_at=NOW()
       WHERE id=$13 AND is_deleted=FALSE RETURNING *`,
      [
        parseFloat(opening_script_score) || 0, parseFloat(verification_score) || 0,
        parseFloat(product_knowledge_score) || 0, parseFloat(compliance_score) || 0,
        parseFloat(communication_score) || 0, parseFloat(closing_score) || 0,
        parseFloat(call_handling_score) || 0, total_score, status, qa_remarks,
        evaluation_date, req.body.metadata ? JSON.stringify(req.body.metadata) : null, req.params.id,
      ]
    );

    res.json({ success: true, message: 'Evaluation updated.', data: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/evaluations/:id
 */
const deleteEvaluation = async (req, res, next) => {
  try {
    const result = await query(
      'UPDATE qa_evaluations SET is_deleted=TRUE, deleted_at=NOW() WHERE id=$1 AND is_deleted=FALSE RETURNING id',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Evaluation not found.' });
    }
    res.json({ success: true, message: 'Evaluation deleted.' });
  } catch (error) {
    next(error);
  }
};

module.exports = { createEvaluation, getEvaluations, getEvaluationById, updateEvaluation, deleteEvaluation };
