const { query } = require('../config/database');

/**
 * GET /api/dashboard/stats
 */
const getDashboardStats = async (req, res, next) => {
  try {
    const isUser = req.user.role === 'User';
    const userId = req.user.id;

    const baseWhere = isUser ? `WHERE is_deleted = FALSE AND agent_id = $1` : `WHERE is_deleted = FALSE`;
    const params = isUser ? [userId] : [];

    const callLeadsQuery = isUser ? `SELECT COUNT(*) FROM call_leads ${baseWhere}` : `SELECT COUNT(*) FROM call_leads WHERE is_deleted = FALSE`;

    const [
      totalCalls,
      totalEvaluated,
      avgScore,
      passedCalls,
      failedCalls,
      criticalErrors,
      pendingFeedback,
      acknowledgedFeedback,
    ] = await Promise.all([
      query(callLeadsQuery, params),
      query(`SELECT COUNT(*) FROM qa_evaluations ${baseWhere}`, params),
      query(`SELECT COALESCE(ROUND(AVG(total_score)::numeric, 2), 0) as avg FROM qa_evaluations ${baseWhere}`, params),
      query(`SELECT COUNT(*) FROM qa_evaluations ${baseWhere} AND status = 'Pass'`, params),
      query(`SELECT COUNT(*) FROM qa_evaluations ${baseWhere} AND status = 'Fail'`, params),
      query(isUser 
        ? `SELECT COUNT(ece.*) FROM evaluation_critical_errors ece JOIN qa_evaluations qe ON ece.evaluation_id = qe.id WHERE qe.agent_id = $1 AND qe.is_deleted = FALSE`
        : `SELECT COUNT(*) FROM evaluation_critical_errors`, params),
      query(isUser 
        ? `SELECT COUNT(*) FROM feedback WHERE feedback_status = 'Pending' AND agent_id = $1` 
        : `SELECT COUNT(*) FROM feedback WHERE feedback_status = 'Pending'`, params),
      query(isUser 
        ? `SELECT COUNT(*) FROM feedback WHERE feedback_status = 'Acknowledged by Agent' AND agent_id = $1` 
        : `SELECT COUNT(*) FROM feedback WHERE feedback_status = 'Acknowledged by Agent'`, params),
    ]);

    res.json({
      success: true,
      data: {
        totalCalls: parseInt(totalCalls.rows[0].count),
        totalEvaluated: parseInt(totalEvaluated.rows[0].count),
        avgScore: parseFloat(avgScore.rows[0].avg),
        passedCalls: parseInt(passedCalls.rows[0].count),
        failedCalls: parseInt(failedCalls.rows[0].count),
        criticalErrors: parseInt(criticalErrors.rows[0].count),
        pendingFeedback: parseInt(pendingFeedback.rows[0].count),
        acknowledgedFeedback: parseInt(acknowledgedFeedback.rows[0].count),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/dashboard/charts
 */
const getDashboardCharts = async (req, res, next) => {
  try {
    const isUser = req.user.role === 'User';
    const userId = req.user.id;
    const baseWhere = isUser ? `WHERE is_deleted = FALSE AND agent_id = $1` : `WHERE is_deleted = FALSE`;
    const params = isUser ? [userId] : [];

    // Agent-wise QA Score (top 10) - Only relevant for Managers
    let agentScores = { rows: [] };
    if (!isUser) {
      agentScores = await query(
        `SELECT agent_name, agent_id,
                ROUND(AVG(total_score)::numeric, 2) as avg_score,
                COUNT(*) as total_evaluations,
                COUNT(CASE WHEN status = 'Pass' THEN 1 END) as passed,
                COUNT(CASE WHEN status = 'Fail' THEN 1 END) as failed
         FROM qa_evaluations
         WHERE is_deleted = FALSE
         GROUP BY agent_name, agent_id
         ORDER BY avg_score DESC
         LIMIT 10`
      );
    }

    // Campaign-wise QA Score
    const campaignScores = await query(
      `SELECT campaign_name,
              ROUND(AVG(total_score)::numeric, 2) as avg_score,
              COUNT(*) as total_evaluations,
              COUNT(CASE WHEN status = 'Pass' THEN 1 END) as passed,
              COUNT(CASE WHEN status = 'Fail' THEN 1 END) as failed
       FROM qa_evaluations
       ${baseWhere}
       GROUP BY campaign_name
       ORDER BY avg_score DESC`, params
    );

    // Critical Error Summary
    const criticalErrorSummaryQuery = isUser 
      ? `SELECT ece.error_type, ece.severity, COUNT(*) as count
         FROM evaluation_critical_errors ece
         JOIN qa_evaluations qe ON ece.evaluation_id = qe.id
         WHERE qe.agent_id = $1 AND qe.is_deleted = FALSE
         GROUP BY ece.error_type, ece.severity
         ORDER BY count DESC
         LIMIT 10`
      : `SELECT error_type, severity, COUNT(*) as count
         FROM evaluation_critical_errors
         GROUP BY error_type, severity
         ORDER BY count DESC
         LIMIT 10`;
         
    const criticalErrorSummary = await query(criticalErrorSummaryQuery, params);

    // Monthly QA Performance (last 6 months)
    const monthlyWhere = isUser ? `WHERE is_deleted = FALSE AND agent_id = $1 AND evaluation_date >= NOW() - INTERVAL '6 months'` : `WHERE is_deleted = FALSE AND evaluation_date >= NOW() - INTERVAL '6 months'`;
    const monthlyPerformance = await query(
      `SELECT TO_CHAR(evaluation_date, 'YYYY-MM') as month,
              ROUND(AVG(total_score)::numeric, 2) as avg_score,
              COUNT(*) as total,
              COUNT(CASE WHEN status = 'Pass' THEN 1 END) as passed,
              COUNT(CASE WHEN status = 'Fail' THEN 1 END) as failed
       FROM qa_evaluations
       ${monthlyWhere}
       GROUP BY TO_CHAR(evaluation_date, 'YYYY-MM')
       ORDER BY month ASC`, params
    );

    // Feedback status distribution
    const feedbackStatusQuery = isUser
      ? `SELECT feedback_status, COUNT(*) as count FROM feedback WHERE agent_id = $1 GROUP BY feedback_status ORDER BY count DESC`
      : `SELECT feedback_status, COUNT(*) as count FROM feedback GROUP BY feedback_status ORDER BY count DESC`;
    const feedbackStatus = await query(feedbackStatusQuery, params);

    res.json({
      success: true,
      data: {
        agentScores: agentScores.rows,
        campaignScores: campaignScores.rows,
        criticalErrorSummary: criticalErrorSummary.rows,
        monthlyPerformance: monthlyPerformance.rows,
        feedbackStatus: feedbackStatus.rows,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getDashboardStats, getDashboardCharts };
