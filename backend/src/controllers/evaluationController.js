const { query, getClient } = require('../config/database');
const { nyDateStart, nyLocal } = require('../utils/timezone');
const { applyEvaluationQaStatus, pushQaStatusToHrms } = require('../services/evaluationQaStatusSync');
const { agentCanAccessCampaign, agentCampaignSql, campaignFamily } = require('../utils/campaignAccess');
const { parsePagination } = require('../utils/pagination');

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
  // The validation/lookup phase below runs before BEGIN, so a failure there
  // must not issue a ROLLBACK ("no transaction in progress" masks the cause).
  let inTransaction = false;
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

    const campAccess = agentCanAccessCampaign(req.user, {
      campaign_id: call.campaign_id,
      campaign_name: call.campaign_name,
    });
    if (!campAccess.ok) {
      return res.status(403).json({ success: false, message: campAccess.message });
    }

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
    inTransaction = true;

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

    // Propagate outcome to dialer_sales_history (matched by dialer lead id / phone)
    const { rows: dialerRows } = await applyEvaluationQaStatus(
      (sql, params) => client.query(sql, params),
      call,
      finalStatus,
      metadata
    );

    await client.query('COMMIT');

    // Only notify HRMS once the local transaction is durable
    pushQaStatusToHrms(dialerRows, 'evaluation create');

    res.status(201).json({
      success: true,
      message: 'Evaluation created successfully.',
      data: evaluation,
    });
  } catch (error) {
    if (inTransaction) {
      await client.query('ROLLBACK').catch(() => {});
    }
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
    const { agent_id, campaign_name, status, from_date, to_date, search } = req.query;
    const { page, limit, offset } = parsePagination(req.query, { defaultLimit: 20 });

    const conditions = ['qe.is_deleted = FALSE'];
    const params = [];
    let pc = 1;

    // QA users see only evaluations they performed, filtered by their assigned campaign
    if (req.user.role === 'QA Agent') {
      conditions.push(`qe.evaluated_by = $${pc}`);
      params.push(req.user.id);
      pc++;
      const camp = agentCampaignSql(req.user, 'qe', pc);
      conditions.push(camp.sql);
      params.push(...camp.params);
      pc = camp.next;
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

    params.push(limit); params.push(offset);

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
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
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
        total_score=$8, status=$9, qa_remarks=$10,
        evaluation_date=COALESCE($11, evaluation_date), metadata=COALESCE($12::jsonb, metadata),
        recordings=COALESCE($13::jsonb, recordings), updated_at=NOW()
       WHERE id=$14 AND is_deleted=FALSE RETURNING *`,
      [
        parseFloat(opening_script_score) || 0, parseFloat(verification_score) || 0,
        parseFloat(product_knowledge_score) || 0, parseFloat(compliance_score) || 0,
        parseFloat(communication_score) || 0, parseFloat(closing_score) || 0,
        parseFloat(call_handling_score) || 0, total_score, status, qa_remarks,
        evaluation_date || null, req.body.metadata ? JSON.stringify(req.body.metadata) : null,
        recsJson, req.params.id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Evaluation not found.' });
    }

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

    // Re-propagate the (possibly changed) outcome to dialer_sales_history + HRMS
    const updated = result.rows[0];
    const callRes = await query('SELECT * FROM call_leads WHERE id = $1', [updated.call_lead_id]);
    if (callRes.rows[0]) {
      try {
        const { rows: dialerRows } = await applyEvaluationQaStatus(query, callRes.rows[0], updated.status, updated.metadata);
        pushQaStatusToHrms(dialerRows, 'evaluation update');
      } catch (syncErr) {
        console.warn('[QA Status Sync] update propagation failed:', syncErr.message);
      }
    }

    res.json({ success: true, message: 'Evaluation updated.', data: updated });
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
      'UPDATE qa_evaluations SET is_deleted=TRUE, deleted_at=NOW() WHERE id=$1 AND is_deleted=FALSE RETURNING id, call_lead_id',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Evaluation not found.' });
    }

    const callLeadId = result.rows[0].call_lead_id;
    if (callLeadId) {
      const remaining = await query(
        'SELECT id FROM qa_evaluations WHERE call_lead_id = $1 AND is_deleted = FALSE LIMIT 1',
        [callLeadId]
      );
      if (remaining.rows.length === 0) {
        await query('UPDATE call_leads SET is_evaluated = FALSE WHERE id = $1', [callLeadId]);
      }
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

    // QA Agents only ever see their own assignments; the qa_user_id filter is
    // for managers/admins drilling into a specific evaluator.
    const scopedQaUserId = req.user.role === 'QA Agent' ? req.user.id : qa_user_id;
    if (scopedQaUserId) {
      conditions.push(`la.assigned_to = $${pc}`);
      params.push(scopedQaUserId);
      pc++;
    }

    if (search) {
      conditions.push(`(u.name ILIKE $${pc} OR cl.agent_name ILIKE $${pc} OR la.campaign_name ILIKE $${pc})`);
      params.push(`%${search}%`);
      pc++;
    }
    if (campaign_name) {
      // Match the whole campaign family, not just the stored label — the same
      // campaign appears as a team name or "<name> Dialer" across tables.
      const family = campaignFamily(campaign_name) || String(campaign_name).trim().toLowerCase();
      conditions.push(`(
        LOWER(COALESCE(la.campaign_name, '')) LIKE $${pc}
        OR LOWER(COALESCE(qe.campaign_name, '')) LIKE $${pc}
        OR LOWER(COALESCE(cl.campaign_name, '')) LIKE $${pc}
        OR LOWER(COALESCE(uc.name, '')) LIKE $${pc}
        OR cl.campaign_id IN (SELECT id FROM campaigns WHERE LOWER(name) LIKE $${pc})
        OR qe.campaign_id IN (SELECT id FROM campaigns WHERE LOWER(name) LIKE $${pc})
      )`);
      params.push(`%${family}%`);
      pc++;
    }
    // A row belongs to the window when either the assignment or the evaluation
    // falls inside it. Both bounds have to be applied to the same side of that
    // OR, otherwise an assignment outside the range is pulled in by an
    // evaluation inside it (and vice versa).
    if (from_date || to_date) {
      const from = from_date || to_date;
      const to = to_date || from_date;
      const fromParam = `$${pc++}`;
      const toParam = `$${pc++}`;
      params.push(from, to);
      conditions.push(`(
        (la.assigned_at >= ${nyDateStart(fromParam)} AND la.assigned_at < ${nyDateStart(toParam, 1)})
        OR (qe.evaluation_date BETWEEN ${fromParam}::date AND ${toParam}::date)
      )`);
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
        TO_CHAR(${nyLocal('la.assigned_at')}, 'YYYY-MM-DD') as assigned_at_est,
        cl.customer_phone,
        cl.agent_name as call_agent_name,
        cl.agent_id as call_agent_id,
        qe.id as evaluation_id,
        COALESCE(NULLIF(qe.metadata->>'qa_status', ''), qe.status) as qa_status,
        qe.total_score,
        qe.evaluation_date,
        qe.metadata->>'laSideErrorCategory' as la_error_category,
        qe.metadata->>'laSideFeedback' as la_feedback,
        qe.metadata->>'agentSideFeedback' as agent_feedback
      FROM lead_assignments la
      JOIN users u ON la.assigned_to = u.id
      JOIN call_leads cl ON la.call_lead_id = cl.id
      LEFT JOIN campaigns uc ON uc.id = u.campaign_id
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
 * GET /api/evaluations/reports/rejected
 * Every evaluation whose QA outcome is Rejected, one row per call, with the
 * agent-side and LA-side feedback the QA wrote. QA Agents only see their own.
 */
const getRejectedCallsReport = async (req, res, next) => {
  try {
    const { from_date, to_date, search, campaign_name, qa_user_id, team, page = 1, limit = 50 } = req.query;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(500, Math.max(1, parseInt(limit) || 50));
    const offset = (pageNum - 1) * limitNum;

    const conditions = [
      'qe.is_deleted = FALSE',
      // UI stores the real outcome in metadata.qa_status; legacy rows only have status = Fail.
      `LOWER(COALESCE(NULLIF(qe.metadata->>'qa_status', ''), qe.status)) IN ('rejected', 'fail')`,
    ];
    const params = [];
    let pc = 1;

    const scopedQaUserId = req.user.role === 'QA Agent' ? req.user.id : qa_user_id;
    if (scopedQaUserId) {
      conditions.push(`qe.evaluated_by = $${pc}`);
      params.push(scopedQaUserId);
      pc++;
    }
    if (from_date) { conditions.push(`qe.evaluation_date >= $${pc}::date`); params.push(from_date); pc++; }
    if (to_date) { conditions.push(`qe.evaluation_date <= $${pc}::date`); params.push(to_date); pc++; }
    if (campaign_name) {
      // Evaluations often store a team ("TeamBrad") or a dialer name
      // ("Medicare Dialer") instead of the campaign row's name, so match the
      // whole campaign family: names, campaign ids, and the evaluator's
      // assigned campaign. Mirrors getDailyQaReport.
      const family = campaignFamily(campaign_name) || String(campaign_name).trim().toLowerCase();
      conditions.push(`(
        LOWER(COALESCE(qe.campaign_name, '')) LIKE $${pc}
        OR LOWER(COALESCE(cl.campaign_name, '')) LIKE $${pc}
        OR LOWER(COALESCE(uc.name, '')) LIKE $${pc}
        OR qe.campaign_id IN (SELECT id FROM campaigns WHERE LOWER(name) LIKE $${pc})
        OR cl.campaign_id IN (SELECT id FROM campaigns WHERE LOWER(name) LIKE $${pc})
      )`);
      params.push(`%${family}%`);
      pc++;
    }
    if (team) {
      conditions.push(`COALESCE(NULLIF(qe.metadata->>'teams', ''), qe.campaign_name) ILIKE $${pc}`);
      params.push(`%${team}%`);
      pc++;
    }
    const term = String(search || '').trim();
    if (term) {
      const textClauses = [
        `qe.agent_name ILIKE $${pc}`,
        `qe.campaign_name ILIKE $${pc}`,
        `COALESCE(qe.metadata->>'teams', '') ILIKE $${pc}`,
        `COALESCE(qe.metadata->>'dids', '') ILIKE $${pc}`,
        `COALESCE(qe.metadata->>'laSideErrorCategory', '') ILIKE $${pc}`,
        `COALESCE(qe.metadata->>'errorCategory', '') ILIKE $${pc}`,
        `COALESCE(qe.metadata->>'agentSideFeedback', '') ILIKE $${pc}`,
        `COALESCE(qe.metadata->>'laSideFeedback', '') ILIKE $${pc}`,
        `u.name ILIKE $${pc}`,
        `cl.customer_phone ILIKE $${pc}`,
      ];
      params.push(`%${term}%`);
      pc++;

      // Phone numbers are typed with/without dashes, spaces or +1; compare digits only.
      const digits = term.replace(/\D/g, '');
      if (digits.length >= 3) {
        textClauses.push(`regexp_replace(COALESCE(cl.customer_phone, ''), '\\D', '', 'g') LIKE $${pc}`);
        params.push(`%${digits}%`);
        pc++;
      }
      conditions.push(`(${textClauses.join(' OR ')})`);
    }

    const where = 'WHERE ' + conditions.join(' AND ');
    const fromClause = `
      FROM qa_evaluations qe
      JOIN call_leads cl ON cl.id = qe.call_lead_id
      JOIN users u ON u.id = qe.evaluated_by
      LEFT JOIN campaigns uc ON uc.id = u.campaign_id
    `;

    // Range-wide summary for the KPI cards (independent of pagination).
    const [summaryRes, topAgentRes] = await Promise.all([
      query(
        `SELECT
           COUNT(*)::int                                                        AS total,
           COUNT(DISTINCT LOWER(TRIM(qe.agent_name)))::int                      AS agents,
           COUNT(DISTINCT LOWER(TRIM(COALESCE(NULLIF(qe.metadata->>'teams', ''), qe.campaign_name))))::int AS teams,
           COUNT(*) FILTER (
             WHERE COALESCE(qe.metadata->>'agentSideFeedback', '') = ''
               AND COALESCE(qe.metadata->>'laSideFeedback', '') = ''
           )::int                                                               AS missing_feedback
         ${fromClause} ${where}`,
        params
      ),
      query(
        `SELECT qe.agent_name, COUNT(*)::int AS count
         ${fromClause} ${where}
         GROUP BY qe.agent_name
         ORDER BY count DESC, qe.agent_name ASC
         LIMIT 1`,
        params
      ),
    ]);
    const summary = {
      ...summaryRes.rows[0],
      top_agent: topAgentRes.rows[0] ? { name: topAgentRes.rows[0].agent_name, count: topAgentRes.rows[0].count } : null,
    };
    const total = summary.total;

    const rowsRes = await query(
      `SELECT
         qe.id                                                        AS evaluation_id,
         qe.call_lead_id,
         qe.agent_name,
         qe.agent_id,
         COALESCE(NULLIF(qe.metadata->>'teams', ''), qe.campaign_name) AS team,
         qe.campaign_name,
         cl.customer_phone                                            AS phone,
         NULLIF(qe.metadata->>'dids', '')                             AS dids,
         NULLIF(qe.metadata->>'talkTime', '')                         AS talk_time,
         NULLIF(qe.metadata->>'dup', '')                              AS dup,
         'Rejected'                                                   AS qa_status,
         COALESCE(qe.metadata->>'agentSideFeedback', '')              AS agent_feedback,
         COALESCE(qe.metadata->>'laSideFeedback', '')                 AS la_feedback,
         NULLIF(qe.metadata->>'laSideErrorCategory', '')              AS la_error_category,
         NULLIF(qe.metadata->>'errorCategory', '')                    AS error_category,
         COALESCE(NULLIF(qe.recording_url, ''), NULLIF(cl.recording_url, '')) AS recording_url,
         qe.evaluation_date,
         cl.call_date,
         u.name                                                       AS qa_name,
         qe.evaluated_by                                              AS qa_user_id,
         qe.created_at
       ${fromClause}
       ${where}
       ORDER BY qe.evaluation_date DESC, qe.created_at DESC
       LIMIT $${pc} OFFSET $${pc + 1}`,
      [...params, limitNum, offset]
    );

    res.json({
      success: true,
      data: rowsRes.rows,
      summary,
      pagination: { total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/evaluations/reports/medicare-daily
 * Every submitted evaluation sheet, one row per form, exactly as the QA filled
 * it in — the same columns the team keeps in their daily Excel workbook.
 * Defaults to the Medicare campaign family; pass campaign_name to widen or
 * switch, or `all` for every campaign.
 */
const getMedicareDailyEvaluations = async (req, res, next) => {
  try {
    const { from_date, to_date, qa_user_id, search, campaign_name } = req.query;
    const { page, limit, offset } = parsePagination(req.query, { defaultLimit: 100, maxLimit: 1000 });

    const conditions = ['qe.is_deleted = FALSE'];
    const params = [];
    let pc = 1;

    const scopedQaUserId = req.user.role === 'QA Agent' ? req.user.id : qa_user_id;
    if (scopedQaUserId) {
      conditions.push(`qe.evaluated_by = $${pc}`);
      params.push(scopedQaUserId);
      pc++;
    }
    if (from_date) { conditions.push(`qe.evaluation_date >= $${pc}::date`); params.push(from_date); pc++; }
    if (to_date) { conditions.push(`qe.evaluation_date <= $${pc}::date`); params.push(to_date); pc++; }

    // The sheet is Medicare's, so scope to that family unless asked otherwise.
    // Teams are stored as free text ("TEAM BRAD"), hence the wide match that
    // also looks at campaign ids and the evaluator's assigned campaign.
    const requested = String(campaign_name || 'Medicare').trim();
    if (requested.toLowerCase() !== 'all') {
      const family = campaignFamily(requested) || requested.toLowerCase();
      conditions.push(`(
        LOWER(COALESCE(qe.campaign_name, '')) LIKE $${pc}
        OR LOWER(COALESCE(cl.campaign_name, '')) LIKE $${pc}
        OR LOWER(COALESCE(qe.metadata->>'teams', '')) LIKE $${pc}
        OR LOWER(COALESCE(uc.name, '')) LIKE $${pc}
        OR qe.campaign_id IN (SELECT id FROM campaigns WHERE LOWER(name) LIKE $${pc})
        OR cl.campaign_id IN (SELECT id FROM campaigns WHERE LOWER(name) LIKE $${pc})
      )`);
      params.push(`%${family}%`);
      pc++;
    }

    const term = String(search || '').trim();
    if (term) {
      const clauses = [
        `qe.agent_name ILIKE $${pc}`,
        `u.name ILIKE $${pc}`,
        `COALESCE(qe.metadata->>'teams', '') ILIKE $${pc}`,
        `COALESCE(qe.metadata->>'dids', '') ILIKE $${pc}`,
        `COALESCE(qe.metadata->>'laSideErrorCategory', '') ILIKE $${pc}`,
        `COALESCE(qe.metadata->>'agentSideFeedback', '') ILIKE $${pc}`,
        `COALESCE(qe.metadata->>'laSideFeedback', '') ILIKE $${pc}`,
        `cl.customer_phone ILIKE $${pc}`,
      ];
      params.push(`%${term}%`);
      pc++;

      const digits = term.replace(/\D/g, '');
      if (digits.length >= 3) {
        clauses.push(`regexp_replace(COALESCE(cl.customer_phone, ''), '\\D', '', 'g') LIKE $${pc}`);
        params.push(`%${digits}%`);
        pc++;
      }
      conditions.push(`(${clauses.join(' OR ')})`);
    }

    const where = 'WHERE ' + conditions.join(' AND ');
    const fromClause = `
      FROM qa_evaluations qe
      JOIN call_leads cl ON cl.id = qe.call_lead_id
      JOIN users u ON u.id = qe.evaluated_by
      LEFT JOIN campaigns uc ON uc.id = u.campaign_id
    `;

    // Range-wide totals for the KPI strip, independent of the current page.
    const normStatus = `
      CASE
        WHEN LOWER(COALESCE(NULLIF(qe.metadata->>'qa_status', ''), qe.status)) IN ('accepted', 'pass') THEN 'Accepted'
        WHEN LOWER(COALESCE(NULLIF(qe.metadata->>'qa_status', ''), qe.status)) IN ('rejected', 'fail') THEN 'Rejected'
        WHEN LOWER(COALESCE(NULLIF(qe.metadata->>'qa_status', ''), qe.status)) = 'flagged' THEN 'Flagged'
        ELSE 'Other'
      END`;

    const [summaryRes, topReasonRes] = await Promise.all([
      query(
        `SELECT
           COUNT(*)::int                                                   AS total,
           COUNT(*) FILTER (WHERE ${normStatus} = 'Accepted')::int         AS accepted,
           COUNT(*) FILTER (WHERE ${normStatus} = 'Rejected')::int         AS rejected,
           COUNT(*) FILTER (WHERE ${normStatus} = 'Flagged')::int          AS flagged,
           COUNT(DISTINCT LOWER(TRIM(qe.agent_name)))::int                 AS agents,
           COUNT(DISTINCT qe.evaluated_by)::int                            AS qa_executives,
           COUNT(DISTINCT LOWER(TRIM(COALESCE(NULLIF(qe.metadata->>'teams', ''), qe.campaign_name))))::int AS teams
         ${fromClause} ${where}`,
        params
      ),
      query(
        `SELECT NULLIF(TRIM(qe.metadata->>'laSideErrorCategory'), '') AS reason, COUNT(*)::int AS count
         ${fromClause} ${where}
           AND NULLIF(TRIM(qe.metadata->>'laSideErrorCategory'), '') IS NOT NULL
         GROUP BY 1
         ORDER BY count DESC, reason ASC
         LIMIT 1`,
        params
      ),
    ]);

    const summary = {
      ...summaryRes.rows[0],
      top_reason: topReasonRes.rows[0]
        ? { reason: topReasonRes.rows[0].reason, count: topReasonRes.rows[0].count }
        : null,
    };
    const total = summary.total;

    const rowsRes = await query(
      `SELECT
         qe.id                                                         AS evaluation_id,
         qe.call_lead_id,
         qe.evaluation_date,
         qe.agent_name,
         COALESCE(NULLIF(qe.metadata->>'teams', ''), qe.campaign_name) AS team,
         cl.customer_phone                                             AS phone,
         NULLIF(qe.metadata->>'dids', '')                              AS dids,
         NULLIF(qe.metadata->>'talkTime', '')                          AS talk_time,
         NULLIF(qe.metadata->>'dup', '')                               AS dup,
         COALESCE(NULLIF(qe.metadata->>'qa_status', ''), qe.status)     AS status,
         COALESCE(qe.metadata->>'agentSideFeedback', '')               AS agent_side,
         COALESCE(qe.metadata->>'laSideFeedback', '')                  AS la_side,
         NULLIF(qe.metadata->>'laSideErrorCategory', '')               AS dropping_reason,
         NULLIF(qe.metadata->>'errorCategory', '')                     AS error_category,
         u.name                                                        AS qa_name,
         qe.evaluated_by                                               AS qa_user_id,
         qe.created_at
       ${fromClause}
       ${where}
       ORDER BY qe.evaluation_date DESC, qe.created_at DESC
       LIMIT $${pc} OFFSET $${pc + 1}`,
      [...params, limit, offset]
    );

    res.json({
      success: true,
      data: rowsRes.rows,
      summary,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/evaluations/reports/daily
 * Per-QA-agent daily productivity report. Because QA listens to both the agent
 * side and the LA side of every call, each evaluated call counts twice for the
 * "calls evaluated" volume (agent-side = N, LA-side = N, total = 2N), while the
 * Accepted / Rejected / Flagged outcome counts stay at N (one outcome per call).
 * QA Agents only ever see their own numbers.
 */
const getDailyQaReport = async (req, res, next) => {
  try {
    const { from_date, to_date, campaign_name, qa_user_id } = req.query;

    const conditions = ['qe.is_deleted = FALSE'];
    const params = [];
    let pc = 1;

    const scopedQaUserId = req.user.role === 'QA Agent' ? req.user.id : qa_user_id;
    if (scopedQaUserId) {
      conditions.push(`qe.evaluated_by = $${pc}`);
      params.push(scopedQaUserId);
      pc++;
    }
    if (req.user.role === 'QA Agent') {
      const camp = agentCampaignSql(req.user, 'qe', pc);
      conditions.push(camp.sql);
      params.push(...camp.params);
      pc = camp.next;
    }
    if (from_date) { conditions.push(`qe.evaluation_date >= $${pc}::date`); params.push(from_date); pc++; }
    if (to_date) { conditions.push(`qe.evaluation_date <= $${pc}::date`); params.push(to_date); pc++; }
    if (campaign_name) {
      const family = campaignFamily(campaign_name) || String(campaign_name).trim().toLowerCase();
      conditions.push(`(
        LOWER(COALESCE(qe.campaign_name, '')) LIKE $${pc}
        OR LOWER(COALESCE(cl.campaign_name, '')) LIKE $${pc}
        OR LOWER(COALESCE(uc.name, '')) LIKE $${pc}
        OR qe.campaign_id IN (SELECT id FROM campaigns WHERE LOWER(name) LIKE $${pc})
        OR cl.campaign_id IN (SELECT id FROM campaigns WHERE LOWER(name) LIKE $${pc})
      )`);
      params.push(`%${family}%`);
      pc++;
    }

    const where = 'WHERE ' + conditions.join(' AND ');
    // Normalise the many status spellings into the five outcomes the UI shows.
    const normStatus = `
      CASE
        WHEN LOWER(COALESCE(NULLIF(qe.metadata->>'qa_status', ''), qe.status)) IN ('accepted', 'pass') THEN 'Accepted'
        WHEN LOWER(COALESCE(NULLIF(qe.metadata->>'qa_status', ''), qe.status)) IN ('rejected', 'fail') THEN 'Rejected'
        WHEN LOWER(COALESCE(NULLIF(qe.metadata->>'qa_status', ''), qe.status)) = 'flagged' THEN 'Flagged'
        WHEN LOWER(COALESCE(NULLIF(qe.metadata->>'qa_status', ''), qe.status)) = 'decline' THEN 'Decline'
        WHEN LOWER(COALESCE(NULLIF(qe.metadata->>'qa_status', ''), qe.status)) IN ('not billable', 'not bilable') THEN 'Not Billable'
        ELSE 'Other'
      END`;

    const baseCte = `
      WITH evals AS (
        SELECT
          qe.evaluated_by                                   AS qa_user_id,
          u.name                                            AS qa_name,
          uc.name                                           AS qa_campaign,
          ${normStatus}                                     AS norm_status,
          NULLIF(qe.metadata->>'laSideErrorCategory', '')   AS la_error_category
        FROM qa_evaluations qe
        JOIN users u ON u.id = qe.evaluated_by
        LEFT JOIN campaigns uc ON uc.id = u.campaign_id
        LEFT JOIN call_leads cl ON cl.id = qe.call_lead_id
        ${where}
      )`;

    const [agentsRes, catsRes] = await Promise.all([
      query(
        `${baseCte}
         SELECT
           qa_user_id,
           qa_name,
           qa_campaign,
           COUNT(*)::int                                          AS evaluated,
           COUNT(*) FILTER (WHERE norm_status = 'Accepted')::int  AS accepted,
           COUNT(*) FILTER (WHERE norm_status = 'Rejected')::int  AS rejected,
           COUNT(*) FILTER (WHERE norm_status = 'Flagged')::int   AS flagged,
           COUNT(*) FILTER (WHERE norm_status = 'Decline')::int   AS decline,
           COUNT(*) FILTER (WHERE norm_status = 'Not Billable')::int AS not_billable
         FROM evals
         GROUP BY qa_user_id, qa_name, qa_campaign
         ORDER BY evaluated DESC, qa_name ASC`,
        params
      ),
      query(
        `${baseCte}
         SELECT qa_user_id, la_error_category AS category, COUNT(*)::int AS count
         FROM evals
         WHERE la_error_category IS NOT NULL
         GROUP BY qa_user_id, la_error_category
         ORDER BY count DESC`,
        params
      ),
    ]);

    const catsByAgent = {};
    catsRes.rows.forEach((row) => {
      (catsByAgent[row.qa_user_id] = catsByAgent[row.qa_user_id] || []).push({
        category: row.category,
        count: row.count,
      });
    });

    const rate = (num, den) => (den > 0 ? parseFloat(((num / den) * 100).toFixed(2)) : 0);

    const agents = agentsRes.rows.map((r) => ({
      qa_user_id: r.qa_user_id,
      qa_name: r.qa_name,
      campaign_name: r.qa_campaign || null,
      evaluated: r.evaluated,
      agent_side: r.evaluated,
      la_side: r.evaluated,
      total: r.evaluated * 2,
      accepted: r.accepted,
      rejected: r.rejected,
      flagged: r.flagged,
      decline: r.decline,
      not_billable: r.not_billable,
      pass_rate: rate(r.accepted, r.evaluated),
      fail_rate: rate(r.rejected, r.evaluated),
      top_categories: (catsByAgent[r.qa_user_id] || []).slice(0, 5),
    }));

    const sum = (key) => agents.reduce((acc, a) => acc + a[key], 0);
    const totalEvaluated = sum('evaluated');
    const totals = {
      qa_agents: agents.length,
      evaluated: totalEvaluated,
      agent_side: totalEvaluated,
      la_side: totalEvaluated,
      total: totalEvaluated * 2,
      accepted: sum('accepted'),
      rejected: sum('rejected'),
      flagged: sum('flagged'),
      decline: sum('decline'),
      not_billable: sum('not_billable'),
      pass_rate: rate(sum('accepted'), totalEvaluated),
      fail_rate: rate(sum('rejected'), totalEvaluated),
    };

    await ensureDailySummariesTable();
    const campaignKey = String(campaign_name || '').trim();
    const fromKey = from_date || '1900-01-01';
    const toKey = to_date || '9999-12-31';
    const sumRes = await query(
      `SELECT qa_user_id, summary
       FROM qa_daily_report_summaries
       WHERE from_date = $1::date AND to_date = $2::date AND campaign_key = $3`,
      [fromKey, toKey, campaignKey]
    );
    const summaries = {};
    sumRes.rows.forEach((row) => {
      summaries[String(row.qa_user_id)] = row.summary || '';
    });

    res.json({
      success: true,
      range: { from: from_date || null, to: to_date || null },
      agents,
      totals,
      summaries,
    });
  } catch (error) {
    next(error);
  }
};

async function ensureDailySummariesTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS qa_daily_report_summaries (
      id SERIAL PRIMARY KEY,
      qa_user_id INTEGER NOT NULL DEFAULT 0,
      from_date DATE NOT NULL,
      to_date DATE NOT NULL,
      campaign_key TEXT NOT NULL DEFAULT '',
      summary TEXT NOT NULL DEFAULT '',
      updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (qa_user_id, from_date, to_date, campaign_key)
    )
  `);
}

/**
 * PUT /api/evaluations/reports/daily/summary
 * Save the handwritten Summary block for one QA executive (or the team rollup).
 */
const saveDailyQaSummary = async (req, res, next) => {
  try {
    const { from_date, to_date, campaign_name, summary } = req.body || {};
    let qaUserId = Number(req.body?.qa_user_id);
    if (!Number.isFinite(qaUserId)) qaUserId = 0;

    if (req.user.role === 'QA Agent') {
      qaUserId = req.user.id;
    }

    const text = String(summary || '');
    if (text.length > 8000) {
      return res.status(400).json({ success: false, message: 'Summary must be 8000 characters or less.' });
    }

    await ensureDailySummariesTable();
    const fromKey = from_date || '1900-01-01';
    const toKey = to_date || '9999-12-31';
    const campaignKey = String(campaign_name || '').trim();

    const result = await query(
      `INSERT INTO qa_daily_report_summaries (qa_user_id, from_date, to_date, campaign_key, summary, updated_by, updated_at)
       VALUES ($1, $2::date, $3::date, $4, $5, $6, NOW())
       ON CONFLICT (qa_user_id, from_date, to_date, campaign_key)
       DO UPDATE SET summary = EXCLUDED.summary, updated_by = EXCLUDED.updated_by, updated_at = NOW()
       RETURNING qa_user_id, summary, updated_at`,
      [qaUserId, fromKey, toKey, campaignKey, text, req.user.id]
    );

    res.json({ success: true, message: 'Summary saved.', data: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

/* ------------------------------------------------------------------ */
/*  Editable dropdown options for the evaluation sheet                 */
/* ------------------------------------------------------------------ */

/**
 * Fields on the evaluation sheet whose dropdown lists users may edit.
 * Keys are the metadata keys used by the sheet; the seed list is what the
 * sheet used to hard-code so nothing disappears on first deploy.
 */
const DROPDOWN_FIELDS = {
  dids: {
    seed: ['D1', 'D3', 'D4', 'D5', 'D6cpl', 'Hi', 'Hi main'],
  },
  laSideErrorCategory: {
    seed: [
      'Already in a good plan',
      'No plan Available',
      'Customer become not intrested',
      'call Back arange',
      'call ended in no result',
      'DNQ Customer',
      'DNC Customer',
      'Not billable',
      'Decline',
    ],
  },
  errorCategory: {
    seed: [
      'DNQ Customer',
      'Under Buffer',
      'Fake Sale',
      'Skipping Qualifying Questions',
      'Quoting Money',
      'Falls Statement',
      'Promoising Statement',
      'DNC Customer',
    ],
  },
};

const MAX_OPTION_LENGTH = 255;

let dropdownTableReady = null;

/**
 * Create the options table on first use and seed it with the historic
 * hard-coded lists plus anything QAs already typed into past evaluations,
 * so production keeps working without a manual migration step.
 */
function ensureDropdownOptionsTable() {
  if (dropdownTableReady) return dropdownTableReady;

  dropdownTableReady = (async () => {
    await query(`
      CREATE TABLE IF NOT EXISTS evaluation_dropdown_options (
        id SERIAL PRIMARY KEY,
        field VARCHAR(50) NOT NULL,
        value VARCHAR(255) NOT NULL,
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE (field, value)
      )
    `);

    for (const [field, cfg] of Object.entries(DROPDOWN_FIELDS)) {
      const existing = await query(
        'SELECT 1 FROM evaluation_dropdown_options WHERE field = $1 LIMIT 1',
        [field]
      );
      if (existing.rowCount > 0) continue;

      const historic = await query(
        `SELECT DISTINCT TRIM(metadata->>$1) AS val
         FROM qa_evaluations
         WHERE TRIM(COALESCE(metadata->>$1, '')) <> ''
         LIMIT 200`,
        [field]
      );
      const values = Array.from(new Set([
        ...cfg.seed,
        ...historic.rows.map(r => r.val).filter(Boolean),
      ]));

      for (const value of values) {
        await query(
          `INSERT INTO evaluation_dropdown_options (field, value)
           VALUES ($1, $2) ON CONFLICT (field, value) DO NOTHING`,
          [field, value.slice(0, MAX_OPTION_LENGTH)]
        );
      }
    }
  })().catch((err) => {
    // Let the next request retry instead of caching a failed promise.
    dropdownTableReady = null;
    throw err;
  });

  return dropdownTableReady;
}

async function loadDropdownOptions() {
  const res = await query(
    `SELECT field, value
     FROM evaluation_dropdown_options
     ORDER BY field, id`
  );
  const options = Object.fromEntries(Object.keys(DROPDOWN_FIELDS).map(f => [f, []]));
  res.rows.forEach(r => {
    if (options[r.field]) options[r.field].push(r.value);
  });
  return options;
}

function dropdownPayload(options) {
  return {
    options,
    // Legacy keys kept for older frontend builds.
    dids: options.dids,
    laSideErrorCategories: options.laSideErrorCategory,
  };
}

function parseOptionInput(body) {
  const field = String(body?.field || '').trim();
  const value = String(body?.value || '').trim().slice(0, MAX_OPTION_LENGTH);
  if (!DROPDOWN_FIELDS[field]) {
    return { error: `Unknown field. Must be one of: ${Object.keys(DROPDOWN_FIELDS).join(', ')}.` };
  }
  if (!value) return { error: 'Option value is required.' };
  return { field, value };
}

/**
 * GET /api/evaluations/options/dropdowns
 */
const getEvaluationDropdownOptions = async (req, res, next) => {
  try {
    await ensureDropdownOptionsTable();
    res.json({ success: true, data: dropdownPayload(await loadDropdownOptions()) });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/evaluations/options/dropdowns  { field, value }
 * Any evaluator may add an option; duplicates (case-insensitive) are ignored.
 */
const addEvaluationDropdownOption = async (req, res, next) => {
  try {
    const parsed = parseOptionInput(req.body);
    if (parsed.error) return res.status(400).json({ success: false, message: parsed.error });

    await ensureDropdownOptionsTable();

    const dup = await query(
      `SELECT value FROM evaluation_dropdown_options
       WHERE field = $1 AND LOWER(value) = LOWER($2) LIMIT 1`,
      [parsed.field, parsed.value]
    );
    if (dup.rowCount === 0) {
      await query(
        `INSERT INTO evaluation_dropdown_options (field, value, created_by)
         VALUES ($1, $2, $3) ON CONFLICT (field, value) DO NOTHING`,
        [parsed.field, parsed.value, req.user.id]
      );
    }

    res.status(dup.rowCount === 0 ? 201 : 200).json({
      success: true,
      message: dup.rowCount === 0 ? 'Option added.' : 'Option already exists.',
      data: dropdownPayload(await loadDropdownOptions()),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/evaluations/options/dropdowns  { field, value }
 * Restricted by the route to admins/managers.
 */
const removeEvaluationDropdownOption = async (req, res, next) => {
  try {
    const parsed = parseOptionInput(req.body);
    if (parsed.error) return res.status(400).json({ success: false, message: parsed.error });

    await ensureDropdownOptionsTable();
    await query(
      'DELETE FROM evaluation_dropdown_options WHERE field = $1 AND value = $2',
      [parsed.field, parsed.value]
    );

    res.json({
      success: true,
      message: 'Option removed.',
      data: dropdownPayload(await loadDropdownOptions()),
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
  getRejectedCallsReport,
  getDailyQaReport,
  getMedicareDailyEvaluations,
  saveDailyQaSummary,
  getEvaluationDropdownOptions,
  addEvaluationDropdownOption,
  removeEvaluationDropdownOption
};
