const { query } = require('../config/database');

/**
 * GET /api/dashboard/stats
 */
const getDashboardStats = async (req, res, next) => {
  try {
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
      query('SELECT COUNT(*) FROM call_leads WHERE is_deleted = FALSE'),
      query('SELECT COUNT(*) FROM qa_evaluations WHERE is_deleted = FALSE'),
      query('SELECT COALESCE(ROUND(AVG(total_score)::numeric, 2), 0) as avg FROM qa_evaluations WHERE is_deleted = FALSE'),
      query("SELECT COUNT(*) FROM qa_evaluations WHERE status = 'Pass' AND is_deleted = FALSE"),
      query("SELECT COUNT(*) FROM qa_evaluations WHERE status = 'Fail' AND is_deleted = FALSE"),
      query('SELECT COUNT(*) FROM evaluation_critical_errors'),
      query("SELECT COUNT(*) FROM feedback WHERE feedback_status = 'Pending'"),
      query("SELECT COUNT(*) FROM feedback WHERE feedback_status = 'Acknowledged by Agent'"),
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
    // Agent-wise QA Score (top 10)
    const agentScores = await query(
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

    // Campaign-wise QA Score
    const campaignScores = await query(
      `SELECT campaign_name,
              ROUND(AVG(total_score)::numeric, 2) as avg_score,
              COUNT(*) as total_evaluations,
              COUNT(CASE WHEN status = 'Pass' THEN 1 END) as passed,
              COUNT(CASE WHEN status = 'Fail' THEN 1 END) as failed
       FROM qa_evaluations
       WHERE is_deleted = FALSE
       GROUP BY campaign_name
       ORDER BY avg_score DESC`
    );

    // Critical Error Summary
    const criticalErrorSummary = await query(
      `SELECT error_type, severity, COUNT(*) as count
       FROM evaluation_critical_errors
       GROUP BY error_type, severity
       ORDER BY count DESC
       LIMIT 10`
    );

    // Monthly QA Performance (last 6 months)
    const monthlyPerformance = await query(
      `SELECT TO_CHAR(evaluation_date, 'YYYY-MM') as month,
              ROUND(AVG(total_score)::numeric, 2) as avg_score,
              COUNT(*) as total,
              COUNT(CASE WHEN status = 'Pass' THEN 1 END) as passed,
              COUNT(CASE WHEN status = 'Fail' THEN 1 END) as failed
       FROM qa_evaluations
       WHERE is_deleted = FALSE
         AND evaluation_date >= NOW() - INTERVAL '6 months'
       GROUP BY TO_CHAR(evaluation_date, 'YYYY-MM')
       ORDER BY month ASC`
    );

    // Feedback status distribution
    const feedbackStatus = await query(
      `SELECT feedback_status, COUNT(*) as count
       FROM feedback
       GROUP BY feedback_status
       ORDER BY count DESC`
    );

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
