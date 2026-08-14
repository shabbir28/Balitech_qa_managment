const { query } = require('../config/database');

/**
 * GET /api/dashboard/stats
 */
const getDashboardStats = async (req, res, next) => {
  try {
    const isUser = req.user.role === 'QA Agent';
    const userId = req.user.id;

    const startDate = req.query.startDate || new Date().toISOString().split('T')[0];
    const endDate = req.query.endDate || new Date().toISOString().split('T')[0];
    const dialerFilter = req.query.dialer;

    // For Users: filter evaluations by who performed them (evaluated_by), not agent_id
    const baseWhere = isUser ? `WHERE is_deleted = FALSE AND evaluated_by = $1 AND DATE(evaluation_date) BETWEEN $2 AND $3` : `WHERE is_deleted = FALSE AND DATE(evaluation_date) BETWEEN $1 AND $2`;
    const callLeadsWhere = isUser ? `WHERE is_deleted = FALSE AND DATE(call_date) BETWEEN $2 AND $3 AND batch_id IN (SELECT DISTINCT batch_id FROM qa_evaluations WHERE evaluated_by = $1 AND is_deleted = FALSE)` : `WHERE is_deleted = FALSE AND DATE(call_date) BETWEEN $1 AND $2`;
    const params = isUser ? [userId, startDate, endDate] : [startDate, endDate];

    const callLeadsQuery = isUser
      ? `SELECT COUNT(*) FROM call_leads ${callLeadsWhere}`
      : `SELECT COUNT(*) FROM call_leads ${callLeadsWhere}`;

    const [
      totalCalls,
      totalEvaluated,
      avgScore,
      passedCalls,
      failedCalls,
      criticalErrors,
      pendingFeedback,
      acknowledgedFeedback,
      dialerStatsData,
      assignedSalesData,
    ] = await Promise.all([
      query(callLeadsQuery, params),
      query(`SELECT COUNT(*) FROM qa_evaluations ${baseWhere}`, params),
      query(`SELECT COALESCE(ROUND(AVG(total_score)::numeric, 2), 0) as avg FROM qa_evaluations ${baseWhere}`, params),
      query(`SELECT COUNT(*) FROM qa_evaluations ${baseWhere} AND status = 'Pass'`, params),
      query(`SELECT COUNT(*) FROM qa_evaluations ${baseWhere} AND status = 'Fail'`, params),
      query(isUser
        ? `SELECT COUNT(ece.*) FROM evaluation_critical_errors ece JOIN qa_evaluations qe ON ece.evaluation_id = qe.id WHERE qe.evaluated_by = $1 AND qe.is_deleted = FALSE AND DATE(qe.evaluation_date) BETWEEN $2 AND $3`
        : `SELECT COUNT(ece.*) FROM evaluation_critical_errors ece JOIN qa_evaluations qe ON ece.evaluation_id = qe.id WHERE qe.is_deleted = FALSE AND DATE(qe.evaluation_date) BETWEEN $1 AND $2`, params),
      query(isUser
        ? `SELECT COUNT(*) FROM feedback WHERE feedback_status = 'Pending' AND agent_user_id = $1 AND DATE(created_at) BETWEEN $2 AND $3`
        : `SELECT COUNT(*) FROM feedback WHERE feedback_status = 'Pending' AND DATE(created_at) BETWEEN $1 AND $2`, params),
      query(isUser
        ? `SELECT COUNT(*) FROM feedback WHERE feedback_status = 'Acknowledged by Agent' AND agent_user_id = $1 AND DATE(created_at) BETWEEN $2 AND $3`
        : `SELECT COUNT(*) FROM feedback WHERE feedback_status = 'Acknowledged by Agent' AND DATE(created_at) BETWEEN $1 AND $2`, params),
      query(`
        SELECT 
          COUNT(*) as total_sales,
          COUNT(CASE WHEN qa_status = 'Accepted' THEN 1 END) as accepted,
          COUNT(CASE WHEN qa_status = 'Rejected' THEN 1 END) as rejected,
          COUNT(CASE WHEN qa_status = 'Flagged' THEN 1 END) as flagged,
          COUNT(CASE WHEN qa_status = 'Pending' THEN 1 END) as pending
        FROM dialer_sales_history
        WHERE sale_date >= $1::date AND sale_date <= $2::date
        ${dialerFilter === 'medicare' || dialerFilter === 'pharmacy' ? `AND dialer = '${dialerFilter}'` : ''}
      `, [startDate, endDate]),
      query(`
        SELECT COUNT(DISTINCT cl.id) as assigned
        FROM call_leads cl
        JOIN lead_assignments la ON cl.id = la.call_lead_id
        WHERE cl.notes LIKE 'Assigned from Dialer Sales page%'
        AND DATE(la.assigned_at) BETWEEN $1::date AND $2::date
      `, [startDate, endDate])
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
        dialerStats: {
          total: parseInt(dialerStatsData?.rows?.[0]?.total_sales || 0),
          accepted: parseInt(dialerStatsData?.rows?.[0]?.accepted || 0),
          rejected: parseInt(dialerStatsData?.rows?.[0]?.rejected || 0),
          flagged: parseInt(dialerStatsData?.rows?.[0]?.flagged || 0),
          pending: parseInt(dialerStatsData?.rows?.[0]?.pending || 0),
          assigned: parseInt(assignedSalesData?.rows?.[0]?.assigned || 0),
        }
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
    const isUser = req.user.role === 'QA Agent';
    const userId = req.user.id;
    // For Users: filter evaluations by who performed them (evaluated_by)
    const baseWhere = isUser ? `WHERE is_deleted = FALSE AND evaluated_by = $1` : `WHERE is_deleted = FALSE`;
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
         WHERE qe.evaluated_by = $1 AND qe.is_deleted = FALSE
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
    const monthlyWhere = isUser ? `WHERE is_deleted = FALSE AND evaluated_by = $1 AND evaluation_date >= NOW() - INTERVAL '6 months'` : `WHERE is_deleted = FALSE AND evaluation_date >= NOW() - INTERVAL '6 months'`;
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
      ? `SELECT feedback_status, COUNT(*) as count FROM feedback WHERE agent_user_id = $1 GROUP BY feedback_status ORDER BY count DESC`
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
