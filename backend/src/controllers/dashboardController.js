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

    // For Users: filter evaluations by who performed them (evaluated_by)
    const baseWhere = isUser 
      ? `WHERE is_deleted = FALSE AND evaluated_by = $1 AND DATE(evaluation_date AT TIME ZONE 'America/New_York') BETWEEN $2 AND $3` 
      : `WHERE is_deleted = FALSE AND DATE(evaluation_date AT TIME ZONE 'America/New_York') BETWEEN $1 AND $2`;
    const callLeadsWhere = isUser 
      ? `WHERE is_deleted = FALSE AND DATE(call_date) BETWEEN $2 AND $3 AND batch_id IN (SELECT DISTINCT batch_id FROM qa_evaluations WHERE evaluated_by = $1 AND is_deleted = FALSE)` 
      : `WHERE is_deleted = FALSE AND DATE(call_date) BETWEEN $1 AND $2`;
    const params = isUser ? [userId, startDate, endDate] : [startDate, endDate];

    const callLeadsQuery = `SELECT COUNT(*) FROM call_leads ${callLeadsWhere}`;

    const [
      totalCalls,
      evalMetrics,
      criticalErrors,
      pendingFeedback,
      acknowledgedFeedback,
      dialerStatsData,
      assignedSalesData,
      totalAgentsData,
      queueData,
      nextCallData,
      todayEvaluatedData,
      recentEvalsData,
    ] = await Promise.all([
      query(callLeadsQuery, params),
      query(`
        SELECT 
          COUNT(*) as total_evaluated,
          COALESCE(ROUND(AVG(total_score)::numeric, 2), 0) as avg_score,
          COUNT(CASE WHEN status IN ('Accepted', 'Pass') THEN 1 END) as accepted_calls,
          COUNT(CASE WHEN status IN ('Rejected', 'Fail') THEN 1 END) as rejected_calls,
          COUNT(CASE WHEN status = 'Decline' THEN 1 END) as decline_calls,
          COUNT(CASE WHEN status IN ('Not Billable', 'Not Bilable') THEN 1 END) as not_billable_calls,
          COUNT(CASE WHEN status = 'Flagged' THEN 1 END) as flagged_calls
        FROM qa_evaluations ${baseWhere}
      `, params),
      query(isUser
        ? `SELECT COUNT(ece.*) FROM evaluation_critical_errors ece JOIN qa_evaluations qe ON ece.evaluation_id = qe.id WHERE qe.evaluated_by = $1 AND qe.is_deleted = FALSE AND DATE(qe.evaluation_date AT TIME ZONE 'America/New_York') BETWEEN $2 AND $3`
        : `SELECT COUNT(ece.*) FROM evaluation_critical_errors ece JOIN qa_evaluations qe ON ece.evaluation_id = qe.id WHERE qe.is_deleted = FALSE AND DATE(qe.evaluation_date AT TIME ZONE 'America/New_York') BETWEEN $1 AND $2`, params),
      query(isUser
        ? `SELECT COUNT(*) FROM feedback WHERE feedback_status = 'Pending' AND agent_user_id = $1`
        : `SELECT COUNT(*) FROM feedback WHERE feedback_status = 'Pending' AND DATE(created_at AT TIME ZONE 'America/New_York') BETWEEN $1 AND $2`, isUser ? [userId] : params),
      query(isUser
        ? `SELECT COUNT(*) FROM feedback WHERE feedback_status = 'Acknowledged by Agent' AND agent_user_id = $1`
        : `SELECT COUNT(*) FROM feedback WHERE feedback_status = 'Acknowledged by Agent' AND DATE(created_at AT TIME ZONE 'America/New_York') BETWEEN $1 AND $2`, isUser ? [userId] : params),
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
      query(isUser ? `
        SELECT COUNT(DISTINCT cl.id) as assigned
        FROM call_leads cl
        JOIN lead_assignments la ON cl.id = la.call_lead_id
        WHERE cl.notes LIKE 'Assigned from Dialer Sales page%'
        AND DATE(la.assigned_at AT TIME ZONE 'America/New_York') BETWEEN $2::date AND $3::date
        AND la.assigned_to = $1
      ` : `
        SELECT COUNT(DISTINCT cl.id) as assigned
        FROM call_leads cl
        JOIN lead_assignments la ON cl.id = la.call_lead_id
        WHERE cl.notes LIKE 'Assigned from Dialer Sales page%'
        AND DATE(la.assigned_at AT TIME ZONE 'America/New_York') BETWEEN $1::date AND $2::date
      `, params),
      query(`SELECT COUNT(*) FROM users WHERE deleted_at IS NULL AND is_active = TRUE AND role_id IN (SELECT id FROM roles WHERE name = 'QA Agent')`),
      // Queue count for user
      isUser ? query(`
        SELECT COUNT(*) as count 
        FROM lead_assignments la
        JOIN call_leads cl ON la.call_lead_id = cl.id
        WHERE la.assigned_to = $1 
          AND la.status IN ('pending', 'accepted')
          AND cl.is_evaluated = FALSE
          AND cl.is_deleted = FALSE
      `, [userId]) : Promise.resolve({ rows: [{ count: 0 }] }),
      // Oldest pending call for user to evaluate
      isUser ? query(`
        SELECT la.id as assignment_id, la.call_lead_id, la.campaign_name, la.status as assignment_status,
               cl.customer_phone, cl.customer_name, cl.call_date, cl.recording_url, cl.recordings, cl.notes
        FROM lead_assignments la
        JOIN call_leads cl ON la.call_lead_id = cl.id
        WHERE la.assigned_to = $1 
          AND la.status IN ('pending', 'accepted')
          AND cl.is_evaluated = FALSE
          AND cl.is_deleted = FALSE
        ORDER BY la.assigned_at ASC, la.id ASC
        LIMIT 1
      `, [userId]) : Promise.resolve({ rows: [] }),
      // Today's evaluations count for target tracking
      query(isUser ? `
        SELECT COUNT(*) as count 
        FROM qa_evaluations 
        WHERE is_deleted = FALSE 
          AND evaluated_by = $1 
          AND DATE(evaluation_date AT TIME ZONE 'America/New_York') = CURRENT_DATE
      ` : `
        SELECT COUNT(*) as count 
        FROM qa_evaluations 
        WHERE is_deleted = FALSE 
          AND DATE(evaluation_date AT TIME ZONE 'America/New_York') = CURRENT_DATE
      `, isUser ? [userId] : []),
      // Recent evaluations for the agent
      query(isUser ? `
        SELECT qe.id as evaluation_id, qe.call_lead_id, qe.status, qe.evaluation_date, qe.total_score, qe.created_at, qe.metadata,
               cl.customer_phone, cl.customer_name, cl.campaign_name, cl.call_duration
        FROM qa_evaluations qe
        JOIN call_leads cl ON qe.call_lead_id = cl.id
        WHERE qe.evaluated_by = $1 AND qe.is_deleted = FALSE
        ORDER BY qe.created_at DESC
        LIMIT 5
      ` : `
        SELECT qe.id as evaluation_id, qe.call_lead_id, qe.status, qe.evaluation_date, qe.total_score, qe.created_at, qe.metadata,
               cl.customer_phone, cl.customer_name, cl.campaign_name, cl.call_duration
        FROM qa_evaluations qe
        JOIN call_leads cl ON qe.call_lead_id = cl.id
        WHERE qe.is_deleted = FALSE
        ORDER BY qe.created_at DESC
        LIMIT 5
      `, isUser ? [userId] : [])
    ]);

    const evalRow = evalMetrics.rows[0] || {};
    const totalEvalCount = parseInt(evalRow.total_evaluated || 0);
    const acceptedCount = parseInt(evalRow.accepted_calls || 0);
    const rejectedCount = parseInt(evalRow.rejected_calls || 0);
    const declineCount = parseInt(evalRow.decline_calls || 0);
    const notBillableCount = parseInt(evalRow.not_billable_calls || 0);
    const flaggedCount = parseInt(evalRow.flagged_calls || 0);
    const acceptanceRate = totalEvalCount > 0 ? Math.round((acceptedCount / totalEvalCount) * 100) : 0;

    res.json({
      success: true,
      data: {
        totalCalls: parseInt(totalCalls.rows[0].count),
        totalEvaluated: totalEvalCount,
        avgScore: parseFloat(evalRow.avg_score || 0),
        passedCalls: acceptedCount,
        failedCalls: rejectedCount,
        criticalErrors: parseInt(criticalErrors.rows[0].count),
        pendingFeedback: parseInt(pendingFeedback.rows[0].count),
        acknowledgedFeedback: parseInt(acknowledgedFeedback.rows[0].count),
        totalAgents: parseInt(totalAgentsData?.rows?.[0]?.count || 0),
        // New Agent-Centric Metrics
        pendingQueueCount: parseInt(queueData.rows[0]?.count || 0),
        nextPendingCall: nextCallData.rows[0] || null,
        todayEvaluated: parseInt(todayEvaluatedData.rows[0]?.count || 0),
        dailyTarget: 30,
        outcomeBreakdown: {
          accepted: acceptedCount,
          rejected: rejectedCount,
          decline: declineCount,
          notBillable: notBillableCount,
          flagged: flaggedCount,
          acceptanceRate: acceptanceRate
        },
        recentEvaluations: recentEvalsData.rows || [],
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

    const startDate = req.query.startDate;
    const endDate = req.query.endDate;

    let dateCond = '';
    let evalParams = [];
    let pIdx = 1;

    if (isUser) {
      evalParams.push(userId);
      pIdx++;
    }

    if (startDate && endDate) {
      dateCond = ` AND DATE(evaluation_date AT TIME ZONE 'America/New_York') BETWEEN $${pIdx} AND $${pIdx + 1}`;
      evalParams.push(startDate, endDate);
      pIdx += 2;
    }

    // For Users: filter evaluations by who performed them (evaluated_by)
    const baseWhere = isUser
      ? `WHERE is_deleted = FALSE AND evaluated_by = $1${dateCond}`
      : `WHERE is_deleted = FALSE${dateCond ? dateCond.replace(/^ AND /, ' AND ') : ''}`;

    // Agent-wise QA Score (top 10) - Only relevant for Managers
    let agentScores = { rows: [] };
    if (!isUser) {
      agentScores = await query(
        `SELECT agent_name, agent_id,
                ROUND(AVG(total_score)::numeric, 2) as avg_score,
                COUNT(*) as total_evaluations,
                COUNT(CASE WHEN status IN ('Accepted', 'Pass') THEN 1 END) as passed,
                COUNT(CASE WHEN status IN ('Rejected', 'Fail') THEN 1 END) as failed
         FROM qa_evaluations
         ${baseWhere}
         GROUP BY agent_name, agent_id
         ORDER BY avg_score DESC
         LIMIT 10`,
        evalParams
      );
    }

    // Campaign-wise QA Score
    const campaignScores = await query(
      `SELECT campaign_name,
              ROUND(AVG(total_score)::numeric, 2) as avg_score,
              COUNT(*) as total_evaluations,
              COUNT(CASE WHEN status IN ('Accepted', 'Pass') THEN 1 END) as passed,
              COUNT(CASE WHEN status IN ('Rejected', 'Fail') THEN 1 END) as failed
       FROM qa_evaluations
       ${baseWhere}
       GROUP BY campaign_name
       ORDER BY avg_score DESC`,
      evalParams
    );

    // Critical Error Summary
    const criticalErrorSummaryQuery = isUser
      ? `SELECT ece.error_type, ece.severity, COUNT(*) as count
         FROM evaluation_critical_errors ece
         JOIN qa_evaluations qe ON ece.evaluation_id = qe.id
         WHERE qe.evaluated_by = $1 AND qe.is_deleted = FALSE ${startDate && endDate ? `AND DATE(qe.evaluation_date AT TIME ZONE 'America/New_York') BETWEEN $2 AND $3` : ''}
         GROUP BY ece.error_type, ece.severity
         ORDER BY count DESC
         LIMIT 10`
      : `SELECT ece.error_type, ece.severity, COUNT(*) as count
         FROM evaluation_critical_errors ece
         JOIN qa_evaluations qe ON ece.evaluation_id = qe.id
         WHERE qe.is_deleted = FALSE ${startDate && endDate ? `AND DATE(qe.evaluation_date AT TIME ZONE 'America/New_York') BETWEEN $1 AND $2` : ''}
         GROUP BY ece.error_type, ece.severity
         ORDER BY count DESC
         LIMIT 10`;

    const critParams = isUser
      ? (startDate && endDate ? [userId, startDate, endDate] : [userId])
      : (startDate && endDate ? [startDate, endDate] : []);
         
    const criticalErrorSummary = await query(criticalErrorSummaryQuery, critParams);

    // Monthly QA Performance (last 6 months)
    const monthlyWhere = isUser
      ? `WHERE is_deleted = FALSE AND evaluated_by = $1 AND evaluation_date >= NOW() - INTERVAL '6 months'`
      : `WHERE is_deleted = FALSE AND evaluation_date >= NOW() - INTERVAL '6 months'`;
    const monthlyPerformance = await query(
      `SELECT TO_CHAR(evaluation_date, 'YYYY-MM') as month,
              ROUND(AVG(total_score)::numeric, 2) as avg_score,
              COUNT(*) as total,
              COUNT(CASE WHEN status IN ('Accepted', 'Pass') THEN 1 END) as passed,
              COUNT(CASE WHEN status IN ('Rejected', 'Fail') THEN 1 END) as failed
       FROM qa_evaluations
       ${monthlyWhere}
       GROUP BY TO_CHAR(evaluation_date, 'YYYY-MM')
       ORDER BY month ASC`,
      isUser ? [userId] : []
    );

    // Feedback status distribution
    const fbDateCond = (startDate && endDate) ? ` AND DATE(created_at AT TIME ZONE 'America/New_York') BETWEEN $${isUser ? 2 : 1} AND $${isUser ? 3 : 2}` : '';
    const feedbackStatusQuery = isUser
      ? `SELECT feedback_status, COUNT(*) as count FROM feedback WHERE agent_user_id = $1${fbDateCond} GROUP BY feedback_status ORDER BY count DESC`
      : `SELECT feedback_status, COUNT(*) as count FROM feedback WHERE 1=1${fbDateCond} GROUP BY feedback_status ORDER BY count DESC`;
    const fbParams = isUser
      ? (startDate && endDate ? [userId, startDate, endDate] : [userId])
      : (startDate && endDate ? [startDate, endDate] : []);
    const feedbackStatus = await query(feedbackStatusQuery, fbParams);

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
