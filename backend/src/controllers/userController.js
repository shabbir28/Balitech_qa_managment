const bcrypt = require('bcryptjs');
const { query } = require('../config/database');

/**
 * GET /api/users
 */
const getUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search, role_id } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const conditions = ['u.deleted_at IS NULL'];
    const params = [];
    let pc = 1;

    if (search) {
      conditions.push(`(u.name ILIKE $${pc} OR u.email ILIKE $${pc})`);
      params.push(`%${search}%`);
      pc++;
    }
    if (role_id) {
      conditions.push(`u.role_id = $${pc}`);
      params.push(role_id);
      pc++;
    }

    const where = 'WHERE ' + conditions.join(' AND ');
    const countResult = await query(`SELECT COUNT(*) FROM users u ${where}`, params);
    const total = parseInt(countResult.rows[0].count);

    params.push(parseInt(limit)); params.push(offset);

    const result = await query(
      `SELECT u.id, u.name, u.email, u.role_id, u.agent_id, u.department, u.phone, u.is_active, u.last_login, u.created_at, r.name as role
       FROM users u JOIN roles r ON u.role_id = r.id
       ${where}
       ORDER BY u.created_at DESC
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
 * PUT /api/users/:id
 */
const updateUser = async (req, res, next) => {
  try {
    const { name, role_id, department, phone, is_active, agent_id } = req.body;
    const result = await query(
      `UPDATE users SET
        name = COALESCE($1, name),
        role_id = COALESCE($2, role_id),
        department = COALESCE($3, department),
        phone = COALESCE($4, phone),
        is_active = COALESCE($5, is_active),
        agent_id = COALESCE($6, agent_id),
        updated_at = NOW()
       WHERE id = $7 AND deleted_at IS NULL
       RETURNING id, name, email, role_id, agent_id, department, phone, is_active`,
      [name, role_id, department, phone, is_active, agent_id, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/users/:id (soft delete)
 */
const deleteUser = async (req, res, next) => {
  try {
    if (parseInt(req.params.id) === req.user.id) {
      return res.status(400).json({ success: false, message: 'Cannot delete your own account.' });
    }
    const result = await query(
      'UPDATE users SET deleted_at = NOW(), is_active = FALSE WHERE id = $1 AND deleted_at IS NULL RETURNING id',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    res.json({ success: true, message: 'User deleted.' });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/users/:id/reset-password
 */
const resetPassword = async (req, res, next) => {
  try {
    const { new_password } = req.body;
    if (!new_password) {
      return res.status(400).json({ success: false, message: 'new_password is required.' });
    }
    const hashed = await bcrypt.hash(new_password, 10);
    await query('UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2', [hashed, req.params.id]);
    res.json({ success: true, message: 'Password reset successfully.' });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/roles
 */
const getRoles = async (req, res, next) => {
  try {
    const result = await query('SELECT * FROM roles ORDER BY id');
    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/campaigns
 */
const getCampaigns = async (req, res, next) => {
  try {
    const result = await query('SELECT * FROM campaigns WHERE deleted_at IS NULL ORDER BY name');
    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/campaigns
 */
const createCampaign = async (req, res, next) => {
  try {
    const { name, description, client_name, passing_score } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Campaign name is required.' });
    const result = await query(
      'INSERT INTO campaigns (name, description, client_name, passing_score) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, description || '', client_name || '', passing_score || 75]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/users/managed-stats
 */
const getManagedUsersStats = async (req, res, next) => {
  try {
    const { campaign, from_date, to_date, search } = req.query;
    
    let whereClause = "la.assigned_by = $1 AND u.deleted_at IS NULL AND r.name IN ('User', 'QA')";
    let params = [req.user.id];
    let paramIdx = 2;

    if (campaign) {
      whereClause += ` AND cl.campaign_name = $${paramIdx++}`;
      params.push(campaign);
    }
    if (from_date) {
      whereClause += ` AND la.assigned_at >= $${paramIdx++}`;
      params.push(from_date);
    }
    if (to_date) {
      whereClause += ` AND la.assigned_at <= $${paramIdx++}`;
      params.push(`${to_date} 23:59:59`);
    }

    if (search) {
      whereClause += ` AND u.name ILIKE $${paramIdx++}`;
      params.push(`%${search}%`);
    }

    const result = await query(`
      SELECT u.id, u.name, u.email, u.role_id, r.name as role, u.department, u.agent_id,
        COUNT(DISTINCT la.id) as total_assigned,
        COUNT(DISTINCT CASE WHEN la.status IN ('pending', 'accepted') THEN la.id END) as pending,
        COUNT(DISTINCT CASE WHEN e.status = 'Pass' THEN e.id END) as accepted,
        COUNT(DISTINCT CASE WHEN e.status = 'Fail' THEN e.id END) as rejected,
        COUNT(DISTINCT CASE WHEN la.status = 'completed' THEN la.id END) as completed
      FROM users u
      JOIN roles r ON u.role_id = r.id
      JOIN lead_assignments la ON la.assigned_to = u.id
      JOIN call_leads cl ON cl.id = la.call_lead_id
      LEFT JOIN qa_evaluations e ON e.call_lead_id = la.call_lead_id AND e.evaluated_by = u.id
      WHERE ${whereClause}
      GROUP BY u.id, r.name
      ORDER BY u.name
    `, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
};

module.exports = { getUsers, updateUser, deleteUser, resetPassword, getRoles, getCampaigns, createCampaign, getManagedUsersStats };
