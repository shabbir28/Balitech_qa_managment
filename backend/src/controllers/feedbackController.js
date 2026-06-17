const { query } = require('../config/database');

/**
 * GET /api/feedback
 * Admin, QA Officer, Team Lead can see all feedback
 */
const getAllFeedback = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, agent_id, status, from_date, to_date, search } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const conditions = [];
    const params = [];
    let pc = 1;

    if (search) {
      conditions.push(`(f.agent_name ILIKE $${pc} OR f.campaign_name ILIKE $${pc})`);
      params.push(`%${search}%`);
      pc++;
    }
    if (agent_id) { conditions.push(`f.agent_id = $${pc}`); params.push(agent_id); pc++; }
    if (status) { conditions.push(`f.feedback_status = $${pc}`); params.push(status); pc++; }
    if (from_date) { conditions.push(`f.created_at >= $${pc}`); params.push(from_date); pc++; }
    if (to_date) { conditions.push(`f.created_at <= $${pc}`); params.push(to_date); pc++; }

    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const countResult = await query(`SELECT COUNT(*) FROM feedback f ${where}`, params);
    const total = parseInt(countResult.rows[0].count);

    params.push(parseInt(limit)); params.push(offset);

    const result = await query(
      `SELECT f.*, qe.evaluation_date, qe.total_score, qe.has_critical_error
       FROM feedback f
       JOIN qa_evaluations qe ON f.evaluation_id = qe.id
       ${where}
       ORDER BY f.created_at DESC
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
 * GET /api/feedback/my-feedback
 * Agents see their own feedback
 */
const getMyFeedback = async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let agentId = req.user.agent_id;
    if (!agentId) {
      return res.status(400).json({ success: false, message: 'No agent ID associated with your account.' });
    }

    const countResult = await query(
      'SELECT COUNT(*) FROM feedback WHERE agent_id = $1',
      [agentId]
    );
    const total = parseInt(countResult.rows[0].count);

    const result = await query(
      `SELECT f.*, qe.evaluation_date, qe.has_critical_error,
              qe.opening_script_score, qe.verification_score, qe.product_knowledge_score,
              qe.compliance_score, qe.communication_score, qe.closing_score, qe.call_handling_score
       FROM feedback f
       JOIN qa_evaluations qe ON f.evaluation_id = qe.id
       WHERE f.agent_id = $1
       ORDER BY f.created_at DESC
       LIMIT $2 OFFSET $3`,
      [agentId, parseInt(limit), offset]
    );

    // Mark as viewed if Pending
    await query(
      `UPDATE feedback SET feedback_status = 'Viewed by Agent', updated_at = NOW()
       WHERE agent_id = $1 AND feedback_status = 'Pending'`,
      [agentId]
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
 * GET /api/feedback/:id
 */
const getFeedbackById = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT f.*, qe.evaluation_date, qe.has_critical_error,
              qe.opening_script_score, qe.verification_score, qe.product_knowledge_score,
              qe.compliance_score, qe.communication_score, qe.closing_score, qe.call_handling_score,
              qe.total_score as eval_total_score
       FROM feedback f
       JOIN qa_evaluations qe ON f.evaluation_id = qe.id
       WHERE f.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Feedback not found.' });
    }

    const feedback = result.rows[0];

    // Get critical errors for this evaluation
    const errors = await query(
      'SELECT * FROM evaluation_critical_errors WHERE evaluation_id = $1',
      [feedback.evaluation_id]
    );
    feedback.critical_errors = errors.rows;

    // Get coaching comments
    const comments = await query(
      `SELECT cc.*, u.name as commenter_name, u.role_id
       FROM coaching_comments cc
       JOIN users u ON cc.commented_by = u.id
       WHERE cc.feedback_id = $1
       ORDER BY cc.created_at ASC`,
      [feedback.id]
    );
    feedback.coaching_comments = comments.rows;

    res.json({ success: true, data: feedback });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/feedback/:id/acknowledge
 */
const acknowledgeFeedback = async (req, res, next) => {
  try {
    const result = await query(
      `UPDATE feedback SET
        feedback_status = 'Acknowledged by Agent',
        acknowledged_at = NOW(),
        updated_at = NOW()
       WHERE id = $1 AND agent_id = $2
       RETURNING *`,
      [req.params.id, req.user.agent_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Feedback not found or not yours.' });
    }

    res.json({ success: true, message: 'Feedback acknowledged.', data: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/feedback/:id/coaching-comment
 */
const addCoachingComment = async (req, res, next) => {
  try {
    const { comment } = req.body;
    if (!comment || comment.trim() === '') {
      return res.status(400).json({ success: false, message: 'Comment is required.' });
    }

    // Mark as coaching required
    await query(
      `UPDATE feedback SET feedback_status = 'Coaching Required', coaching_required = TRUE, updated_at = NOW() WHERE id = $1`,
      [req.params.id]
    );

    const result = await query(
      'INSERT INTO coaching_comments (feedback_id, comment, commented_by) VALUES ($1, $2, $3) RETURNING *',
      [req.params.id, comment.trim(), req.user.id]
    );

    res.status(201).json({ success: true, message: 'Coaching comment added.', data: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/feedback/:id/improvement-suggestions
 */
const updateImprovementSuggestions = async (req, res, next) => {
  try {
    const { improvement_suggestions } = req.body;
    const result = await query(
      'UPDATE feedback SET improvement_suggestions = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [improvement_suggestions, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Feedback not found.' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/feedback/:id/close
 */
const closeFeedback = async (req, res, next) => {
  try {
    const result = await query(
      `UPDATE feedback SET feedback_status = 'Closed', updated_at = NOW() WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Feedback not found.' });
    }
    res.json({ success: true, message: 'Feedback closed.', data: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllFeedback, getMyFeedback, getFeedbackById,
  acknowledgeFeedback, addCoachingComment, updateImprovementSuggestions, closeFeedback,
};
