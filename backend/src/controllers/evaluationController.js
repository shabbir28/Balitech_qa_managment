const { query, getClient } = require('../config/database');

// Must stay in sync with the qa_evaluations_status_check constraint.
const VALID_STATUSES = ['Pass', 'Fail', 'Flagged', 'Accepted', 'Rejected', 'Decline', 'Not Billable', 'Not Bilable'];

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
 * Validate that a score is between 0 and 100
 */
const validateScore = (value, fieldName) => {
  const parsed = parseFloat(value);
  if (value !== undefined && value !== null && value !== '') {
    if (isNaN(parsed) || parsed < 0 || parsed > 100) {
      return `${fieldName} must be a number between 0 and 100.`;
    }
  }
  return null;
};

/**
 * Validate all evaluation scores
 */
const validateAllScores = (body) => {
  const scoreFields = [
    ['opening_script_score', 'Opening Script Score'],
    ['verification_score', 'Verification Score'],
    ['product_knowledge_score', 'Product Knowledge Score'],
    ['compliance_score', 'Compliance Score'],
    ['communication_score', 'Communication Score'],
    ['closing_score', 'Closing Score'],
    ['call_handling_score', 'Call Handling Score'],
  ];
  for (const [field, label] of scoreFields) {
    const err = validateScore(body[field], label);
    if (err) return err;
  }
  return null;
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
      qa_remarks, evaluation_date, critical_errors = [], metadata = {}, recordings = []
    } = req.body;

    if (!call_lead_id) {
      return res.status(400).json({ success: false, message: 'call_lead_id is required.' });
    }

    // Validate all score ranges (0-100)
    const scoreError = validateAllScores(req.body);
    if (scoreError) {
      return res.status(400).json({ success: false, message: scoreError });
    }

    // qa_remarks length limit
    if (qa_remarks && String(qa_remarks).length > 3000) {
      return res.status(400).json({ success: false, message: 'QA remarks must not exceed 3000 characters.' });
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

    // Check already evaluated for THIS call
    const alreadyEvalCall = await query(
      `SELECT q.id FROM qa_evaluations q WHERE q.call_lead_id = $1 AND q.is_deleted = FALSE`,
      [call_lead_id]
    );
    if (alreadyEvalCall.rows.length > 0) {
      return res.status(409).json({ success: false, message: 'This call has already been evaluated.' });
    }

    const total_score = calculateTotalScore({
      opening_script_score, verification_score, product_knowledge_score,
      compliance_score, communication_score, closing_score, call_handling_score,
    });

    const passing_score = call.passing_score || 75;
    const has_critical_error = Array.isArray(critical_errors) && critical_errors.length > 0;

    if (req.body.status && !VALID_STATUSES.includes(req.body.status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}.`,
      });
    }
    const finalStatus = req.body.status || ((has_critical_error || total_score < passing_score) ? 'Fail' : 'Pass');

    if (has_critical_error && (!qa_remarks || qa_remarks.trim() === '')) {
      return res.status(400).json({ success: false, message: 'QA remarks are required when critical errors are selected.' });
    }

    const recsToSave = (call.recordings && Array.isArray(call.recordings) && call.recordings.length > 0)
      ? call.recordings
      : (recordings.length > 0 ? recordings : (metadata?.recordings || []));

    await client.query('BEGIN');

    const evalResult = await client.query(
      `INSERT INTO qa_evaluations (
        call_lead_id, agent_name, agent_id, campaign_name, campaign_id, recording_url,
        opening_script_score, verification_score, product_knowledge_score,
        compliance_score, communication_score, closing_score, call_handling_score,
        total_score, passing_score, status, has_critical_error, qa_remarks,
        evaluation_date, evaluated_by, metadata, recordings
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
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
        total_score,
        passing_score,
        finalStatus,
        has_critical_error,
        qa_remarks || '',
        evaluation_date || new Date().toISOString().split('T')[0],
        req.user.id,
        JSON.stringify(metadata || {}),
        JSON.stringify(recsToSave || [])
      ]
    );

    // If talkTime is provided in metadata, update call_duration in call_leads
    if (metadata?.talkTime) {
      await client.query('UPDATE call_leads SET call_duration = $1 WHERE id = $2', [metadata.talkTime, call_lead_id]);
    }

    // If call_leads does not have recordings cached, cache recsToSave
    if (recsToSave.length > 0 && (!call.recordings || (Array.isArray(call.recordings) && call.recordings.length === 0))) {
      await client.query('UPDATE call_leads SET recordings = $1::jsonb WHERE id = $2', [JSON.stringify(recsToSave), call_lead_id]);
    }

    const evaluation = evalResult.rows[0];

    // Insert critical errors
    for (const ce of (Array.isArray(critical_errors) ? critical_errors : [])) {
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

    // Sync QA status to dialer_sales_history if phone matches
    if (call.customer_phone) {
      await client.query(
        `UPDATE dialer_sales_history
         SET qa_status = $1
         WHERE phone = $2 OR phone = $3`,
        [finalStatus, call.customer_phone, call.customer_phone.replace(/\D/g, '')]
      );
    }

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

    // QA users see only evaluations they performed, filtered by their assigned campaign
    if (req.user.role === 'QA Agent') {
      conditions.push(`qe.evaluated_by = $${pc}`);
      params.push(req.user.id);
      pc++;
      // If user has an assigned campaign, restrict to that campaign only
      if (req.user.campaign_id) {
        conditions.push(`qe.campaign_id = $${pc}`);
        params.push(req.user.campaign_id);
        pc++;
      }
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
    next(error);
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

    // QA Agents may only read evaluations they performed themselves.
    if (req.user.role === 'QA Agent' && evaluation.evaluated_by !== req.user.id) {
      return res.status(403).json({ success: false, message: 'You do not have access to this evaluation.' });
    }

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

    // Validate all score ranges (0-100)
    const scoreError = validateAllScores(req.body);
    if (scoreError) {
      return res.status(400).json({ success: false, message: scoreError });
    }

    // qa_remarks length limit
    if (qa_remarks && String(qa_remarks).length > 3000) {
      return res.status(400).json({ success: false, message: 'QA remarks must not exceed 3000 characters.' });
    }

    const total_score = calculateTotalScore({
      opening_script_score, verification_score, product_knowledge_score,
      compliance_score, communication_score, closing_score, call_handling_score,
    });

    // Get passing score
    const existing = await query('SELECT passing_score, evaluated_by FROM qa_evaluations WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Evaluation not found.' });
    }

    // QA Agents may only modify evaluations they performed themselves.
    if (req.user.role === 'QA Agent' && existing.rows[0].evaluated_by !== req.user.id) {
      return res.status(403).json({ success: false, message: 'You do not have access to this evaluation.' });
    }

    if (req.body.status && !VALID_STATUSES.includes(req.body.status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}.`,
      });
    }

    const passing_score = existing.rows[0].passing_score;
    const status = req.body.status || (total_score < passing_score ? 'Fail' : 'Pass');

    const recsToUpdate = req.body.recordings || req.body.metadata?.recordings || null;
    const recsJson = recsToUpdate && Array.isArray(recsToUpdate) ? JSON.stringify(recsToUpdate) : null;

    const result = await query(
      `UPDATE qa_evaluations SET
        opening_script_score=$1, verification_score=$2, product_knowledge_score=$3,
        compliance_score=$4, communication_score=$5, closing_score=$6, call_handling_score=$7,
        total_score=$8, status=$9, qa_remarks=$10, evaluation_date=$11, metadata=$12,
        recordings=COALESCE($13::jsonb, recordings), updated_at=NOW()
       WHERE id=$14 AND is_deleted=FALSE RETURNING *`,
      [
        parseFloat(opening_script_score) || 0, parseFloat(verification_score) || 0,
        parseFloat(product_knowledge_score) || 0, parseFloat(compliance_score) || 0,
        parseFloat(communication_score) || 0, parseFloat(closing_score) || 0,
        parseFloat(call_handling_score) || 0, total_score, status, qa_remarks,
        evaluation_date, req.body.metadata ? JSON.stringify(req.body.metadata) : null,
        recsJson, req.params.id,
      ]
    );

    // If talkTime is provided in metadata, update call_duration in call_leads
    if (req.body.metadata?.talkTime) {
      await query(
        'UPDATE call_leads SET call_duration = $1 WHERE id = (SELECT call_lead_id FROM qa_evaluations WHERE id = $2)',
        [req.body.metadata.talkTime, req.params.id]
      );
    }

    // If recordings are provided, sync to call_leads
    if (recsJson) {
      await query(
        'UPDATE call_leads SET recordings = $1::jsonb WHERE id = (SELECT call_lead_id FROM qa_evaluations WHERE id = $2)',
        [recsJson, req.params.id]
      );
    }

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

/**
 * GET /api/evaluations/reports/agent-errors
 * Returns aggregated QA statuses & LA Side Error Category counts grouped by QA Evaluator (or Call Agent)
 */
const getAgentErrorReport = async (req, res, next) => {
  try {
    const { campaign_name, from_date, to_date, search, group_by = 'qa', qa_user_id } = req.query;

    const conditions = [];
    const params = [];
    let pc = 1;

    if (qa_user_id) {
      conditions.push(`la.assigned_to = $${pc}`);
      params.push(qa_user_id);
      pc++;
    }

    if (search) {
      conditions.push(`(u.name ILIKE $${pc} OR cl.agent_name ILIKE $${pc} OR la.campaign_name ILIKE $${pc})`);
      params.push(`%${search}%`);
      pc++;
    }
    if (campaign_name) {
      conditions.push(`(la.campaign_name ILIKE $${pc} OR qe.campaign_name ILIKE $${pc})`);
      params.push(`%${campaign_name}%`);
      pc++;
    }
    if (from_date) {
      conditions.push(`(DATE(la.assigned_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/New_York') >= $${pc}::date OR DATE(qe.evaluation_date) >= $${pc}::date)`);
      params.push(from_date);
      pc++;
    }
    if (to_date) {
      conditions.push(`(DATE(la.assigned_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/New_York') <= $${pc}::date OR DATE(qe.evaluation_date) <= $${pc}::date)`);
      params.push(to_date);
      pc++;
    }

    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    // Fetch lead assignments along with evaluation results and metadata
    const reportQuery = `
      SELECT 
        la.id as assignment_id,
        la.assigned_to,
        u.name as qa_name,
        u.email as qa_email,
        la.campaign_name,
        la.status as assignment_status,
        la.assigned_at,
        TO_CHAR(la.assigned_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/New_York', 'YYYY-MM-DD') as assigned_at_est,
        cl.customer_phone,
        cl.agent_name as call_agent_name,
        cl.agent_id as call_agent_id,
        qe.id as evaluation_id,
        qe.status as qa_status,
        qe.total_score,
        qe.evaluation_date,
        qe.metadata->>'laSideErrorCategory' as la_error_category,
        qe.metadata->>'laSideFeedback' as la_feedback,
        qe.metadata->>'agentSideFeedback' as agent_feedback
      FROM lead_assignments la
      JOIN users u ON la.assigned_to = u.id
      JOIN call_leads cl ON la.call_lead_id = cl.id
      LEFT JOIN qa_evaluations qe ON qe.call_lead_id = la.call_lead_id AND qe.is_deleted = FALSE
      ${where}
      ORDER BY la.assigned_at DESC
    `;
    const reportRes = await query(reportQuery, params);

    // Grouping by QA Evaluator (default) or Call Agent
    const map = {};
    const overallCategories = {};
    const overallStatuses = {
      Pending: 0,
      Accepted: 0,
      Rejected: 0,
      Flagged: 0,
      Decline: 0,
      'Not Billable': 0
    };

    reportRes.rows.forEach((row) => {
      const isCallAgentGrouping = group_by === 'call_agent';
      const key = isCallAgentGrouping
        ? (row.call_agent_name || 'Unknown Call Agent')
        : (row.qa_name || `QA User #${row.assigned_to}`);

      if (!map[key]) {
        map[key] = {
          name: key,
          qa_id: row.assigned_to,
          campaign_name: row.campaign_name,
          total_assigned: 0,
          total_evaluated: 0,
          statuses: {
            Pending: 0,
            Accepted: 0,
            Rejected: 0,
            Flagged: 0,
            Decline: 0,
            'Not Billable': 0
          },
          la_categories: {},
          records: []
        };
      }

      const item = map[key];
      item.total_assigned++;

      let st = 'Pending';
      if (row.evaluation_id) {
        item.total_evaluated++;
        st = row.qa_status || 'Pending';
        if (st === 'Pass') st = 'Accepted';
        if (st === 'Fail') st = 'Rejected';
        if (st === 'Not Bilable') st = 'Not Billable';
      }

      item.statuses[st] = (item.statuses[st] || 0) + 1;
      overallStatuses[st] = (overallStatuses[st] || 0) + 1;

      // LA side error category count
      const cat = (row.la_error_category || '').trim();
      if (cat) {
        item.la_categories[cat] = (item.la_categories[cat] || 0) + 1;
        overallCategories[cat] = (overallCategories[cat] || 0) + 1;
      }

      item.records.push({
        id: row.assignment_id,
        phone: row.customer_phone,
        call_agent: row.call_agent_name,
        qa_evaluator: row.qa_name,
        date: row.evaluation_date || row.assigned_at_est || '—',
        qa_status: st,
        la_category: cat || '—',
        la_feedback: row.la_feedback || '—',
        agent_feedback: row.agent_feedback || '—'
      });
    });

    res.json({
      success: true,
      data: Object.values(map),
      total_records: reportRes.rows.length,
      overall_statuses: overallStatuses,
      overall_categories: overallCategories,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/evaluations/options/dropdowns
 * Returns unique DIDs and LA Side Error Categories collected from previous evaluations
 */
const getEvaluationDropdownOptions = async (req, res, next) => {
  try {
    const didsRes = await query(`
      SELECT DISTINCT TRIM(metadata->>'dids') as val
      FROM qa_evaluations
      WHERE metadata->>'dids' IS NOT NULL AND TRIM(metadata->>'dids') != ''
      LIMIT 100
    `);

    const laCatRes = await query(`
      SELECT DISTINCT TRIM(metadata->>'laSideErrorCategory') as val
      FROM qa_evaluations
      WHERE metadata->>'laSideErrorCategory' IS NOT NULL AND TRIM(metadata->>'laSideErrorCategory') != ''
      LIMIT 100
    `);

    const defaultDids = ['D1', 'D3', 'D4', 'D5', 'D6cpl', 'Hi', 'Hi main'];
    const defaultLaCats = [
      'Already in a good plan',
      'No plan Available',
      'Customer become not intrested',
      'call Back arange',
      'call ended in no result',
      'DNQ Customer',
      'DNC Customer',
      'Not billable',
      'Decline'
    ];

    const dbDids = didsRes.rows.map(r => r.val).filter(Boolean);
    const dbLaCats = laCatRes.rows.map(r => r.val).filter(Boolean);

    const mergedDids = Array.from(new Set([...defaultDids, ...dbDids]));
    const mergedLaCats = Array.from(new Set([...defaultLaCats, ...dbLaCats]));

    res.json({
      success: true,
      data: {
        dids: mergedDids,
        laSideErrorCategories: mergedLaCats
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createEvaluation,
  getEvaluations,
  getEvaluationById,
  updateEvaluation,
  deleteEvaluation,
  getAgentErrorReport,
  getEvaluationDropdownOptions
};
