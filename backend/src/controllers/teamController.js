const bcrypt = require('bcryptjs');
const fs = require('fs');
const { query } = require('../config/database');
const { parseFile, normalizeRow } = require('./callController');
const { NY_DAY_START, nyDateStart } = require('../utils/timezone');

/* ─── TEAMS ─────────────────────────────────────────────────────────── */

/**
 * GET /api/teams
 * Manager sees their own teams; Admin sees all
 */
const getTeams = async (req, res, next) => {
  try {
    const isManager = ['Super Admin', 'QA Admin'].includes(req.user.role);
    const params = isManager ? [] : [req.user.id];
    const where = isManager ? '' : 'WHERE t.manager_id = $1';

    const result = await query(
      `SELECT t.*, u.name as manager_name,
        (SELECT COUNT(*) FROM team_members tm WHERE tm.team_id = t.id) as member_count
       FROM teams t
       JOIN users u ON t.manager_id = u.id
       ${where}
       ORDER BY t.created_at DESC`,
      params
    );
    res.json({ success: true, data: result.rows });
  } catch (err) { next(err); }
};

/**
 * POST /api/teams
 */
const createTeam = async (req, res, next) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Team name is required.' });
    const result = await query(
      'INSERT INTO teams (name, description, manager_id) VALUES ($1, $2, $3) RETURNING *',
      [name, description || '', req.user.id]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) { next(err); }
};

/**
 * DELETE /api/teams/:id
 */
const deleteTeam = async (req, res, next) => {
  try {
    const { id } = req.params;
    const check = await query('SELECT manager_id FROM teams WHERE id = $1', [id]);
    if (!check.rows.length) return res.status(404).json({ success: false, message: 'Team not found.' });
    if (!['Super Admin', 'QA Admin'].includes(req.user.role) && check.rows[0].manager_id !== req.user.id)
      return res.status(403).json({ success: false, message: 'Not authorised.' });
    await query('DELETE FROM teams WHERE id = $1', [id]);
    res.json({ success: true, message: 'Team deleted.' });
  } catch (err) { next(err); }
};

/* ─── TEAM MEMBERS ──────────────────────────────────────────────────── */

/**
 * GET /api/teams/:id/members
 */
const getTeamMembers = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT u.id, u.name, u.email, u.agent_id, u.department, r.name as role, tm.added_at
       FROM team_members tm
       JOIN users u ON tm.user_id = u.id
       JOIN roles r ON u.role_id = r.id
       WHERE tm.team_id = $1 AND u.deleted_at IS NULL
       ORDER BY tm.added_at DESC`,
      [req.params.id]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) { next(err); }
};

/**
 * POST /api/teams/:id/members
 */
const addTeamMember = async (req, res, next) => {
  try {
    const { user_id } = req.body;
    if (!user_id) return res.status(400).json({ success: false, message: 'user_id is required.' });
    await query(
      'INSERT INTO team_members (team_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [req.params.id, user_id]
    );
    res.json({ success: true, message: 'Member added.' });
  } catch (err) { next(err); }
};

/**
 * DELETE /api/teams/:id/members/:userId
 */
const removeTeamMember = async (req, res, next) => {
  try {
    await query('DELETE FROM team_members WHERE team_id = $1 AND user_id = $2', [req.params.id, req.params.userId]);
    res.json({ success: true, message: 'Member removed.' });
  } catch (err) { next(err); }
};

/**
 * GET /api/teams/members/available
 * Returns QA Officer users who can be added to a team
 */
const getAvailableUsers = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT u.id, u.name, u.email, u.agent_id, u.department, r.name as role, c.name as campaign_name
       FROM users u
       JOIN roles r ON u.role_id = r.id
       LEFT JOIN campaigns c ON u.campaign_id = c.id
       WHERE u.deleted_at IS NULL AND u.is_active = TRUE AND r.name IN ('QA Agent')
       ORDER BY u.name`,
      []
    );
    res.json({ success: true, data: result.rows });
  } catch (err) { next(err); }
};

/* ─── LEAD ASSIGNMENTS ──────────────────────────────────────────────── */

/**
 * Automatically expires uncompleted assignments (pending, accepted) that were
 * handed out before the current America/New_York day, so a QA Agent's queue
 * only ever holds leads assigned today.
 *
 * Releases dialer sales history assigned state if any un-evaluated leads were assigned from dialer sales.
 */
const expireStaleAssignments = async () => {
  try {
    const staleResult = await query(`
      UPDATE lead_assignments
      SET status = 'expired'
      WHERE status IN ('pending', 'accepted')
        AND assigned_at < ${NY_DAY_START}
        AND (reopened_at IS NULL OR reopened_at < ${NY_DAY_START})
      RETURNING id, call_lead_id
    `);

    if (staleResult.rows.length > 0) {
      const callLeadIds = staleResult.rows.map(r => r.call_lead_id);
      await query(`
        UPDATE dialer_sales_history dsh
        SET is_assigned = FALSE, assigned_qa_name = NULL
        WHERE dsh.is_assigned IS TRUE
          AND (
            dsh.lead_id IN (
              SELECT m[1]
              FROM call_leads cl
              CROSS JOIN LATERAL regexp_match(
                COALESCE(cl.notes, ''),
                '(?:Lead ID:|VICI_LEAD:)\\s*(\\S+)'
              ) AS m
              WHERE cl.id = ANY($1::int[])
                AND cl.is_evaluated IS NOT TRUE
                AND m IS NOT NULL
            )
            OR dsh.phone IN (
              SELECT cl.customer_phone
              FROM call_leads cl
              WHERE cl.id = ANY($1::int[])
                AND cl.is_evaluated IS NOT TRUE
                AND COALESCE(cl.notes, '') !~ '(Lead ID:|VICI_LEAD:)'
            )
          )
      `, [callLeadIds]).catch(err => {
        console.warn('Notice when releasing dialer sales leads for expired assignments:', err.message);
      });
    }

    return staleResult.rows.length;
  } catch (error) {
    console.error('Error in expireStaleAssignments:', error.message);
    throw error;
  }
};

/**
 * An auto-expired assignment keeps its original meaning for history: it was
 * either already accepted by the agent, or still waiting. `accepted_at` tells
 * the two apart, so a past day can be reported exactly as the agent left it.
 */
const EFFECTIVE_STATUS = `
  CASE WHEN la.status = 'expired'
       THEN CASE WHEN la.accepted_at IS NOT NULL THEN 'accepted' ELSE 'pending' END
       ELSE la.status END
`;

/**
 * GET /api/assignments
 * Manager sees assignments; QA member sees their own.
 *
 * `start_date` / `end_date` are America/New_York calendar dates. A QA Agent
 * defaults to the current New York day, so a fresh login always opens on
 * today's queue while older days stay reachable through the date picker.
 */
const getAssignments = async (req, res, next) => {
  try {
    // Automatically expire any uncompleted assignments from previous days
    try { await expireStaleAssignments(); } catch (e) { console.error('Assignment expiration failed:', e.message); }

    const role = req.user.role;
    const { page = 1, limit = 50, status, user_id, start_date, end_date } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    let conditions = [];
    let params = [];
    let paramCount = 1;

    const isLeadership = ['Super Admin', 'QA Admin', 'Manager'].includes(role);

    if (!isLeadership) {
      conditions.push(`la.assigned_to = $${paramCount++}`);
      params.push(req.user.id);
      // If the user has an assigned campaign, filter leads to that campaign only
      if (req.user.campaign_id) {
        conditions.push(`cl.campaign_id = $${paramCount++}`);
        params.push(req.user.campaign_id);
      }
    } else {
      // For Admins/Managers:
      if (user_id) {
        conditions.push(`la.assigned_to = $${paramCount++}`);
        params.push(user_id);
      } else if (role === 'Manager' || req.query.my_assigned === 'true') {
        conditions.push(`la.assigned_by = $${paramCount++}`);
        params.push(req.user.id);
      }
    }

    // Day window. Agents are always scoped to a day; leadership only when asked.
    const rangeStart = start_date || (isLeadership ? null : 'TODAY');
    const rangeEnd = end_date || rangeStart;
    const useExplicitRange = Boolean(rangeStart) && rangeStart !== 'TODAY';
    if (rangeStart === 'TODAY') {
      conditions.push(`la.assigned_at >= ${NY_DAY_START}`);
    } else if (useExplicitRange) {
      conditions.push(`la.assigned_at >= ${nyDateStart(`$${paramCount++}`)}`);
      params.push(rangeStart);
      conditions.push(`la.assigned_at < ${nyDateStart(`$${paramCount++}`, 1)}`);
      params.push(rangeEnd);
    }

    if (status && status !== 'all') {
      conditions.push(`(${EFFECTIVE_STATUS}) = $${paramCount++}`);
      params.push(status);
    }

    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    // Join call_leads in count query if filtering by campaign
    const countJoin = (!isLeadership && req.user.campaign_id) ? 'JOIN call_leads cl ON la.call_lead_id = cl.id' : '';
    const countResult = await query(`SELECT COUNT(*) FROM lead_assignments la ${countJoin} ${where}`, params);
    const total = parseInt(countResult.rows[0].count);

    // Stats describe the same scope as the list, minus the status tab filter.
    const statsConditions = [];
    const statsParams = [];
    let statsCount = 1;
    if (!isLeadership) {
      statsConditions.push(`la.assigned_to = $${statsCount++}`);
      statsParams.push(req.user.id);
    } else if (user_id) {
      statsConditions.push(`la.assigned_to = $${statsCount++}`);
      statsParams.push(user_id);
    } else if (role === 'Manager' || req.query.my_assigned === 'true') {
      statsConditions.push(`la.assigned_by = $${statsCount++}`);
      statsParams.push(req.user.id);
    }
    if (rangeStart === 'TODAY') {
      statsConditions.push(`la.assigned_at >= ${NY_DAY_START}`);
    } else if (useExplicitRange) {
      statsConditions.push(`la.assigned_at >= ${nyDateStart(`$${statsCount++}`)}`);
      statsConditions.push(`la.assigned_at < ${nyDateStart(`$${statsCount++}`, 1)}`);
      statsParams.push(rangeStart, rangeEnd);
    }
    const statsWhere = statsConditions.length ? 'WHERE ' + statsConditions.join(' AND ') : '';

    const statsResult = await query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN (${EFFECTIVE_STATUS}) = 'pending' THEN 1 END) as pending,
        COUNT(CASE WHEN (${EFFECTIVE_STATUS}) = 'accepted' THEN 1 END) as accepted,
        COUNT(CASE WHEN (${EFFECTIVE_STATUS}) = 'rejected' THEN 1 END) as rejected,
        COUNT(CASE WHEN (${EFFECTIVE_STATUS}) = 'completed' THEN 1 END) as completed,
        COUNT(CASE WHEN la.status = 'expired' THEN 1 END) as expired,
        COUNT(CASE WHEN COALESCE(e.metadata->>'qa_status', e.status) IN ('Accepted', 'Pass') THEN 1 END) as eval_accepted,
        COUNT(CASE WHEN COALESCE(e.metadata->>'qa_status', e.status) IN ('Rejected', 'Fail') THEN 1 END) as eval_rejected,
        COUNT(CASE WHEN COALESCE(e.metadata->>'qa_status', e.status) = 'Decline' THEN 1 END) as eval_decline,
        COUNT(CASE WHEN COALESCE(e.metadata->>'qa_status', e.status) IN ('Not Billable', 'Not Bilable') THEN 1 END) as eval_not_billable,
        COUNT(CASE WHEN COALESCE(e.metadata->>'qa_status', e.status) = 'Flagged' THEN 1 END) as eval_flagged
      FROM lead_assignments la
      LEFT JOIN qa_evaluations e ON la.call_lead_id = e.call_lead_id AND e.is_deleted = FALSE
      ${statsWhere}
    `, statsParams);

    params.push(parseInt(limit));
    params.push(offset);

    const result = await query(
      `SELECT la.*,
        (${EFFECTIVE_STATUS}) as effective_status,
        (la.status = 'expired') as is_expired,
        cl.customer_phone, cl.agent_name, cl.campaign_name, cl.call_date, cl.call_duration, cl.recording_url, cl.recordings, cl.disposition,
        c.name as dialer_campaign,
        u1.name as assigned_to_name, u1.email as assigned_to_email,
        u2.name as assigned_by_name,
        COALESCE(e.metadata->>'qa_status', e.status) as evaluation_status, e.id as evaluation_id,
        ub.batch_name, ub.file_name
       FROM lead_assignments la
       JOIN call_leads cl ON la.call_lead_id = cl.id
       LEFT JOIN campaigns c ON cl.campaign_id = c.id
       LEFT JOIN upload_batches ub ON cl.batch_id = ub.id
       JOIN users u1 ON la.assigned_to = u1.id
       JOIN users u2 ON la.assigned_by = u2.id
       LEFT JOIN qa_evaluations e ON e.call_lead_id = la.call_lead_id AND e.is_deleted = FALSE
       ${where}
       ORDER BY la.assigned_at DESC
       LIMIT $${paramCount++} OFFSET $${paramCount++}`,
      params
    );
    res.json({ 
      success: true, 
      data: result.rows,
      stats: statsResult.rows[0],
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (err) { next(err); }
};

/**
 * POST /api/assignments
 * Manager assigns one or more leads to a user
 */
const createAssignments = async (req, res, next) => {
  try {
    // Expire any stale assignments first so newly assigned leads start with a fresh daily queue
    try { await expireStaleAssignments(); } catch (e) { console.error('Assignment expiration failed:', e.message); }

    const { call_lead_ids = [], manual_leads = [], dialer_leads = [], assigned_to, campaign_name, notes } = req.body;
    if ((!call_lead_ids.length && !manual_leads.length && !dialer_leads.length) || !assigned_to)
      return res.status(400).json({ success: false, message: 'Leads and assigned_to are required.' });

    const results = [];

    // Fetch assigned evaluator name for status tagging
    const qaUser = await query('SELECT name FROM users WHERE id = $1', [assigned_to]);
    const qaName = qaUser.rows[0] ? qaUser.rows[0].name : 'QA Evaluator';
    
    // If dialer_leads are provided, do not double-process call_lead_ids
    const effectiveCallLeadIds = dialer_leads.length > 0 ? [] : call_lead_ids;

    // Process selected existing call_leads IDs
    for (const lead_id of effectiveCallLeadIds) {
      const existing = await query('SELECT id FROM lead_assignments WHERE call_lead_id = $1 LIMIT 1', [lead_id]);
      if (existing.rows.length) continue;
      const r = await query(
        `INSERT INTO lead_assignments (call_lead_id, assigned_to, assigned_by, campaign_name, notes)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [lead_id, assigned_to, req.user.id, campaign_name || '', notes || '']
      );
      if (r.rows[0]) results.push(r.rows[0]);
    }

    // Process dialer sales leads (from dialer_sales_history)
    for (const dLead of dialer_leads) {
      const phone = dLead.customer_phone || dLead.phone;
      if (!phone) continue;

      let campId = null;
      if (campaign_name) {
        const campRes = await query(
          'SELECT id FROM campaigns WHERE LOWER(TRIM(name)) = LOWER(TRIM($1)) OR LOWER(TRIM(name)) = LOWER(TRIM($2)) LIMIT 1',
          [campaign_name, `${campaign_name} Dialer`]
        );
        if (campRes.rows[0]) campId = campRes.rows[0].id;
      }

      // Check if call_leads already exists for this phone & campaign
      let existingCallLead = await query(
        'SELECT id FROM call_leads WHERE customer_phone = $1 AND (campaign_id = $2 OR campaign_name ILIKE $3) LIMIT 1',
        [phone, campId, `%${campaign_name || ''}%`]
      );
      let callLeadId = null;

      if (existingCallLead.rows[0]) {
        callLeadId = existingCallLead.rows[0].id;
      } else {
        const ins = await query(
          `INSERT INTO call_leads (agent_name, agent_id, campaign_name, campaign_id, customer_name, customer_phone, call_date, disposition, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING id`,
          [
            dLead.agent_name || dLead.agent || 'Dialer Agent',
            dLead.agent_id || 'DIALER',
            dLead.campaign_name || campaign_name || 'Medicare',
            campId,
            dLead.customer_name || dLead.name || '',
            phone,
            dLead.call_date || new Date(),
            dLead.disposition || dLead.status || 'Sale',
            notes ? `Assigned from Dialer Sales. Notes: ${notes}` : 'Assigned from Dialer Sales'
          ]
        );
        callLeadId = ins.rows[0].id;
      }

      // Assign to user
      const r = await query(
        `INSERT INTO lead_assignments (call_lead_id, assigned_to, assigned_by, campaign_name, notes)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [callLeadId, assigned_to, req.user.id, campaign_name || '', notes || '']
      );
      if (r.rows[0]) results.push(r.rows[0]);

      // Mark assigned in dialer_sales_history if id or lead_id exists
      if (dLead.id) {
        await query(
          `UPDATE dialer_sales_history 
           SET is_assigned = TRUE, assigned_qa_name = $1 
           WHERE id = $2`,
          [qaName, dLead.id]
        );
      } else if (dLead.lead_id) {
        await query(
          `UPDATE dialer_sales_history 
           SET is_assigned = TRUE, assigned_qa_name = $1 
           WHERE lead_id = $2`,
          [qaName, String(dLead.lead_id)]
        );
      }
    }

    // Process manual phone numbers
    for (const phone of manual_leads) {
      if (!phone.trim()) continue;
      
      // Look up campaign ID
      let campId = null;
      if (campaign_name) {
        const campRes = await query('SELECT id FROM campaigns WHERE name = $1 LIMIT 1', [campaign_name]);
        if (campRes.rows[0]) campId = campRes.rows[0].id;
      }

      // Create lead record
      const leadRes = await query(
        `INSERT INTO call_leads (agent_name, agent_id, customer_phone, campaign_name, campaign_id, notes) 
         VALUES ('Manual Entry', 'MANUAL', $1, $2, $3, 'Manually assigned') RETURNING id`,
        [phone.trim(), campaign_name || '', campId]
      );

      const lead_id = leadRes.rows[0].id;

      // Assign it
      const r = await query(
        `INSERT INTO lead_assignments (call_lead_id, assigned_to, assigned_by, campaign_name, notes)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [lead_id, assigned_to, req.user.id, campaign_name || '', notes || '']
      );
      if (r.rows[0]) results.push(r.rows[0]);
    }

    res.status(201).json({ success: true, data: results, message: `${results.length} lead(s) assigned successfully.` });
  } catch (err) { next(err); }
};

/**
 * A lead is still actionable while it is pending, and also when it was auto
 * expired without ever being accepted — an agent may go back to an earlier day
 * and pick it up. `reopened_at` then keeps the expiration job off it for the
 * rest of the current New York day.
 */
const CLAIMABLE = `(status = 'pending' OR (status = 'expired' AND accepted_at IS NULL))`;

/**
 * PATCH /api/assignments/:id/accept
 */
const acceptAssignment = async (req, res, next) => {
  try {
    const result = await query(
      `UPDATE lead_assignments
       SET status = 'accepted',
           accepted_at = NOW(),
           reopened_at = CASE WHEN status = 'expired' THEN NOW() ELSE reopened_at END
       WHERE id = $1 AND assigned_to = $2 AND ${CLAIMABLE}
       RETURNING *`,
      [req.params.id, req.user.id]
    );
    if (!result.rows.length)
      return res.status(404).json({ success: false, message: 'Assignment not found or already accepted/rejected.' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) { next(err); }
};

/**
 * PATCH /api/assignments/:id/reject
 */
const rejectAssignment = async (req, res, next) => {
  try {
    const result = await query(
      `UPDATE lead_assignments SET status = 'rejected', completed_at = NOW()
       WHERE id = $1 AND assigned_to = $2 AND ${CLAIMABLE}
       RETURNING *`,
      [req.params.id, req.user.id]
    );
    if (!result.rows.length)
      return res.status(404).json({ success: false, message: 'Assignment not found or already accepted/rejected.' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) { next(err); }
};

/**
 * PATCH /api/assignments/accept-all
 * Bulk accept the pending assignments of one day for the logged-in user.
 * Defaults to today; `date` (a New York calendar date) accepts an earlier day.
 * Deliberately limited to a single day so a wide range cannot be claimed by
 * accident.
 */
const acceptAllAssignments = async (req, res, next) => {
  try {
    const date = req.body?.date || req.query.date;
    const dayFilter = date
      ? `AND assigned_at >= ${nyDateStart('$2')} AND assigned_at < ${nyDateStart('$2', 1)}`
      : `AND assigned_at >= ${NY_DAY_START}`;

    const result = await query(
      `UPDATE lead_assignments
       SET status = 'accepted',
           accepted_at = NOW(),
           reopened_at = CASE WHEN status = 'expired' THEN NOW() ELSE reopened_at END
       WHERE assigned_to = $1 AND ${CLAIMABLE} ${dayFilter}
       RETURNING *`,
      date ? [req.user.id, date] : [req.user.id]
    );
    res.json({ success: true, message: `${result.rows.length} assignments accepted.` });
  } catch (err) { next(err); }
};

/**
 * PATCH /api/assignments/:id/complete
 */
const completeAssignment = async (req, res, next) => {
  try {
    const result = await query(
      `UPDATE lead_assignments SET status = 'completed', completed_at = NOW()
       WHERE id = $1 AND assigned_to = $2
       RETURNING *`,
      [req.params.id, req.user.id]
    );
    if (!result.rows.length)
      return res.status(404).json({ success: false, message: 'Assignment not found.' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) { next(err); }
};

/**
 * DELETE /api/assignments/:id
 */
const deleteAssignment = async (req, res, next) => {
  try {
    let result;
    if (['Super Admin', 'QA Admin'].includes(req.user.role)) {
      result = await query(
        'DELETE FROM lead_assignments WHERE id = $1 RETURNING id',
        [req.params.id]
      );
    } else {
      result = await query(
        'DELETE FROM lead_assignments WHERE id = $1 AND assigned_by = $2 RETURNING id',
        [req.params.id, req.user.id]
      );
    }
    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'Assignment not found or you do not have permission to delete it.' });
    }
    res.json({ success: true, message: 'Assignment deleted.' });
  } catch (err) { next(err); }
};

/* ─── MANAGER USER CREATION ──────────────────────────────────────────── */

/**
 * POST /api/teams/create-user
 * Manager creates a new QA user account
 */
const createManagedUser = async (req, res, next) => {
  try {
    const { name, email, password, role_id, department, campaign_id } = req.body;
    if (!name || !email || !password || !role_id)
      return res.status(400).json({ success: false, message: 'name, email, password, and role_id are required.' });

    // Name length validation
    if (name.trim().length < 2 || name.trim().length > 100) {
      return res.status(400).json({ success: false, message: 'Name must be between 2 and 100 characters.' });
    }

    // Password strength validation
    if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters and contain at least one letter and one number.',
      });
    }

    // Validate role_id
    const parsedRoleId = parseInt(role_id, 10);
    if (isNaN(parsedRoleId) || parsedRoleId < 1) {
      return res.status(400).json({ success: false, message: 'Invalid role_id.' });
    }

    const roleRes = await query('SELECT id, name FROM roles WHERE id = $1', [parsedRoleId]);
    if (!roleRes.rows[0] || roleRes.rows[0].name !== 'QA Agent') {
      return res.status(403).json({
        success: false,
        message: 'You can only create QA Agent accounts from this screen.',
      });
    }

    // Normalize email
    const normalizedEmail = email.toLowerCase().trim();

    const existing = await query('SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL', [normalizedEmail]);
    if (existing.rows.length) return res.status(409).json({ success: false, message: 'Email already in use.' });

    const hashed = await bcrypt.hash(password, 12);
    const result = await query(
      `INSERT INTO users (name, email, password, role_id, department, campaign_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, email, role_id, department, campaign_id`,
      [
        name.trim().substring(0, 100),
        normalizedEmail,
        hashed,
        parsedRoleId,
        department ? String(department).trim().substring(0, 100) : '',
        campaign_id || null,
      ]
    );
    res.status(201).json({ success: true, data: result.rows[0], message: 'User created successfully.' });
  } catch (err) { next(err); }
};

/**
 * POST /api/assignments/upload
 * Manager assigns leads from an uploaded file (CSV/TXT)
 */
const uploadAssignments = async (req, res, next) => {
  try {
    // Expire any stale assignments first so newly assigned leads start with a fresh daily queue
    try { await expireStaleAssignments(); } catch (e) { console.error('Assignment expiration failed:', e.message); }

    const { assigned_to, campaign_name, notes } = req.body;
    if (!req.file || !assigned_to) {
      return res.status(400).json({ success: false, message: 'File and assigned_to are required.' });
    }

    let campId = null;
    if (campaign_name) {
      const campRes = await query('SELECT id FROM campaigns WHERE name = $1 LIMIT 1', [campaign_name]);
      if (campRes.rows[0]) campId = campRes.rows[0].id;
    }

    // Use robust CSV/Excel parser
    const rows = await parseFile(req.file.path);

    if (rows.length === 0) {
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({ success: false, message: 'File is empty or invalid.' });
    }

    const batchResult = await query(
      `INSERT INTO upload_batches (batch_name, file_name, file_path, total_records, uploaded_by, status)
       VALUES ($1, $2, $3, $4, $5, 'completed') RETURNING id`,
      [
        req.body.batch_name || `Assignment-${Date.now()}`,
        req.file.originalname,
        req.file.filename,
        rows.length,
        req.user.id,
      ]
    );
    const batchId = batchResult.rows[0].id;

    const { pool } = require('../config/database');
    let totalInserted = 0;
    const batchSize = 1000;

    const processBatch = async (chunk) => {
      if (!chunk.length) return;
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        let leadValues = [];
        let leadParams = [];
        let leadIdx = 1;

        for (const row of chunk) {
          const norm = normalizeRow(row);
          let phone = norm.customer_phone || Object.values(row)[0] || '';
          if (!phone || !String(phone).trim()) continue;

          let aName = norm.agent_name || 'Manual Entry';
          let aId = norm.agent_id || 'AGT-MANUAL';
          let cName = norm.campaign_name || campaign_name || '';
          let cDate = norm.call_date || null;
          if (cDate) {
            let numDate = Number(cDate);
            if (!isNaN(numDate) && numDate > 20000 && numDate < 100000) {
              const excelEpoch = new Date(Date.UTC(1899, 11, 30));
              cDate = new Date(excelEpoch.getTime() + numDate * 86400000).toISOString();
            } else if (isNaN(Date.parse(cDate))) {
              cDate = null;
            }
          }
          let dur = norm.call_duration || '';
          let recUrl = norm.recording_url || '';
          let disp = norm.disposition || '';
          let cNotes = norm.notes || notes || 'Manually assigned via file';

          leadValues.push(`($${leadIdx++}, $${leadIdx++}, $${leadIdx++}, $${leadIdx++}, $${leadIdx++}, $${leadIdx++}, $${leadIdx++}, $${leadIdx++}, $${leadIdx++}, $${leadIdx++}, $${leadIdx++})`);
          leadParams.push(batchId, aName, aId, cName, campId, String(phone).trim(), cDate, dur, recUrl, disp, cNotes);
        }

        if (leadValues.length === 0) {
          await client.query('ROLLBACK');
          return;
        }

        const leadRes = await client.query(`INSERT INTO call_leads (batch_id, agent_name, agent_id, campaign_name, campaign_id, customer_phone, call_date, call_duration, recording_url, disposition, notes) VALUES ${leadValues.join(', ')} RETURNING id`, leadParams);
        
        let assignValues = [];
        let assignParams = [];
        let assignIdx = 1;
        for (const r of leadRes.rows) {
          assignValues.push(`($${assignIdx++}, $${assignIdx++}, $${assignIdx++}, $${assignIdx++}, $${assignIdx++})`);
          assignParams.push(r.id, assigned_to, req.user.id, campaign_name || '', notes || '');
        }
        await client.query(`INSERT INTO lead_assignments (call_lead_id, assigned_to, assigned_by, campaign_name, notes) VALUES ${assignValues.join(', ')}`, assignParams);
        
        await client.query('COMMIT');
        totalInserted += leadRes.rows.length;
      } catch (e) {
        await client.query('ROLLBACK');
        console.error('Batch insert error:', e.message, e.detail || '', e.stack);
      } finally {
        client.release();
      }
    };

    for (let i = 0; i < rows.length; i += batchSize) {
      await processBatch(rows.slice(i, i + batchSize));
    }
    
    fs.unlink(req.file.path, () => {});
    if (totalInserted === 0) {
      return res.status(500).json({
        success: false,
        message: 'Failed to assign any leads from the file. Check the file format and try again.',
      });
    }
    res.status(201).json({ success: true, message: `${totalInserted} lead(s) assigned successfully from file.` });
  } catch (err) {
    if (req.file) fs.unlink(req.file.path, () => {});
    next(err);
  }
};

module.exports = {
  getTeams, createTeam, deleteTeam,
  getTeamMembers, addTeamMember, removeTeamMember, getAvailableUsers,
  getAssignments, createAssignments, acceptAssignment, rejectAssignment, acceptAllAssignments, completeAssignment, deleteAssignment, uploadAssignments,
  createManagedUser,
  expireStaleAssignments,
};
