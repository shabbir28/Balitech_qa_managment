const bcrypt = require('bcryptjs');
const { query } = require('../config/database');

/* ─── TEAMS ─────────────────────────────────────────────────────────── */

/**
 * GET /api/teams
 * Manager sees their own teams; Admin sees all
 */
const getTeams = async (req, res, next) => {
  try {
    const isManager = req.user.role === 'Manager';
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
    if (req.user.role !== 'Manager' && check.rows[0].manager_id !== req.user.id)
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
      `SELECT u.id, u.name, u.email, u.agent_id, u.department, r.name as role
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.deleted_at IS NULL AND u.is_active = TRUE AND r.name IN ('User')
       ORDER BY u.name`,
      []
    );
    res.json({ success: true, data: result.rows });
  } catch (err) { next(err); }
};

/* ─── LEAD ASSIGNMENTS ──────────────────────────────────────────────── */

/**
 * GET /api/assignments
 * Manager sees assignments they created; QA member sees their own
 */
const getAssignments = async (req, res, next) => {
  try {
    const role = req.user.role;
    const { page = 1, limit = 50, status, user_id } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    let conditions = [];
    let params = [];
    let paramCount = 1;

    if (role !== 'Manager') {
      conditions.push(`la.assigned_to = $${paramCount++}`);
      params.push(req.user.id);
    } else {
      conditions.push(`la.assigned_by = $${paramCount++}`);
      params.push(req.user.id);
      if (user_id) {
        conditions.push(`la.assigned_to = $${paramCount++}`);
        params.push(user_id);
      }
    }
    
    if (status && status !== 'all') {
      conditions.push(`la.status = $${paramCount++}`);
      params.push(status);
    }

    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const countResult = await query(`SELECT COUNT(*) FROM lead_assignments la ${where}`, params);
    const total = parseInt(countResult.rows[0].count);
    
    let countParams = role !== 'Manager' ? [req.user.id] : [req.user.id];
    let countWhere = role !== 'Manager' ? 'WHERE assigned_to = $1' : 'WHERE assigned_by = $1';
    if (role === 'Manager' && user_id) {
      countWhere += ' AND assigned_to = $2';
      countParams.push(user_id);
    }
    
    const statsResult = await query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
        COUNT(CASE WHEN status = 'accepted' THEN 1 END) as accepted,
        COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed
      FROM lead_assignments 
      ${countWhere}
    `, countParams);

    params.push(parseInt(limit));
    params.push(offset);

    const result = await query(
      `SELECT la.*,
        cl.customer_phone, cl.agent_name, cl.campaign_name, cl.call_date, cl.call_duration, cl.recording_url, cl.disposition,
        u1.name as assigned_to_name, u1.email as assigned_to_email,
        u2.name as assigned_by_name,
        e.status as evaluation_status, e.id as evaluation_id
       FROM lead_assignments la
       JOIN call_leads cl ON la.call_lead_id = cl.id
       JOIN users u1 ON la.assigned_to = u1.id
       JOIN users u2 ON la.assigned_by = u2.id
       LEFT JOIN qa_evaluations e ON e.call_lead_id = la.call_lead_id AND e.evaluated_by = la.assigned_to
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
    const { call_lead_ids = [], manual_leads = [], assigned_to, campaign_name, notes } = req.body;
    if ((!call_lead_ids.length && !manual_leads.length) || !assigned_to)
      return res.status(400).json({ success: false, message: 'Leads and assigned_to are required.' });

    const results = [];
    
    // Process selected existing leads
    for (const lead_id of call_lead_ids) {
      const r = await query(
        `INSERT INTO lead_assignments (call_lead_id, assigned_to, assigned_by, campaign_name, notes)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT DO NOTHING
         RETURNING *`,
        [lead_id, assigned_to, req.user.id, campaign_name || '', notes || '']
      );
      if (r.rows[0]) results.push(r.rows[0]);
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
        `INSERT INTO call_leads (agent_name, customer_phone, campaign_name, campaign_id, notes) 
         VALUES ('Manual Entry', $1, $2, $3, 'Manually assigned') RETURNING id`,
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
 * PATCH /api/assignments/:id/accept
 */
const acceptAssignment = async (req, res, next) => {
  try {
    const result = await query(
      `UPDATE lead_assignments SET status = 'accepted', accepted_at = NOW()
       WHERE id = $1 AND assigned_to = $2 AND status = 'pending'
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
       WHERE id = $1 AND assigned_to = $2 AND status = 'pending'
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
 * Bulk accept all pending assignments for the logged-in user
 */
const acceptAllAssignments = async (req, res, next) => {
  try {
    const result = await query(
      `UPDATE lead_assignments SET status = 'accepted', accepted_at = NOW()
       WHERE assigned_to = $1 AND status = 'pending'
       RETURNING *`,
      [req.user.id]
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
    await query('DELETE FROM lead_assignments WHERE id = $1 AND assigned_by = $2', [req.params.id, req.user.id]);
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
    const { name, email, password, role_id, department } = req.body;
    if (!name || !email || !password || !role_id)
      return res.status(400).json({ success: false, message: 'name, email, password, and role_id are required.' });

    const existing = await query('SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL', [email]);
    if (existing.rows.length) return res.status(409).json({ success: false, message: 'Email already in use.' });

    const hashed = await bcrypt.hash(password, 10);
    const result = await query(
      `INSERT INTO users (name, email, password, role_id, department)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, email, role_id, department`,
      [name, email, hashed, role_id, department || '']
    );
    res.status(201).json({ success: true, data: result.rows[0], message: 'User created successfully.' });
  } catch (err) { next(err); }
};

const fs = require('fs');
const { parseFile, normalizeRow } = require('./callController');

/**
 * POST /api/assignments/upload
 * Manager assigns leads from an uploaded file (CSV/TXT)
 */
const uploadAssignments = async (req, res, next) => {
  try {
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
          let dur = norm.call_duration || '';
          let recUrl = norm.recording_url || '';
          let disp = norm.disposition || '';
          let cNotes = norm.notes || notes || 'Manually assigned via file';

          leadValues.push(`($${leadIdx++}, $${leadIdx++}, $${leadIdx++}, $${leadIdx++}, $${leadIdx++}, $${leadIdx++}, $${leadIdx++}, $${leadIdx++}, $${leadIdx++}, $${leadIdx++})`);
          leadParams.push(aName, aId, cName, campId, String(phone).trim(), cDate, dur, recUrl, disp, cNotes);
        }

        if (leadValues.length === 0) {
          await client.query('ROLLBACK');
          client.release();
          return;
        }

        const leadRes = await client.query(`INSERT INTO call_leads (agent_name, agent_id, campaign_name, campaign_id, customer_phone, call_date, call_duration, recording_url, disposition, notes) VALUES ${leadValues.join(', ')} RETURNING id`, leadParams);
        
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
        console.error('Batch insert error', e);
      } finally {
        client.release();
      }
    };

    for (let i = 0; i < rows.length; i += batchSize) {
      await processBatch(rows.slice(i, i + batchSize));
    }
    
    fs.unlink(req.file.path, () => {});
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
};
