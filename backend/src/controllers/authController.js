const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/database');

/**
 * POST /api/auth/login
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const result = await query(
      `SELECT u.*, r.name as role 
       FROM users u 
       JOIN roles r ON u.role_id = r.id 
       WHERE u.email = $1 AND u.deleted_at IS NULL`,
      [email.toLowerCase().trim()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(401).json({ success: false, message: 'Account is deactivated. Contact administrator.' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    // Update last login
    await query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      success: true,
      message: 'Login successful.',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        role_id: user.role_id,
        agent_id: user.agent_id,
        department: user.department,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/register
 */
const register = async (req, res, next) => {
  try {
    const { name, email, password, role_id, agent_id, department, phone } = req.body;

    if (!name || !email || !password || !role_id) {
      return res.status(400).json({ success: false, message: 'Name, email, password, and role are required.' });
    }

    // Check if email exists
    const existing = await query('SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL', [email.toLowerCase()]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ success: false, message: 'Email already registered.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await query(
      `INSERT INTO users (name, email, password, role_id, agent_id, department, phone)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, name, email, role_id, agent_id, department, created_at`,
      [name.trim(), email.toLowerCase().trim(), hashedPassword, role_id, agent_id || null, department || null, phone || null]
    );

    // If agent role, create agent record
    if (parseInt(role_id) === 4 && agent_id) {
      await query(
        'INSERT INTO agents (name, agent_id, user_id, email, department) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (agent_id) DO NOTHING',
        [name.trim(), agent_id, result.rows[0].id, email.toLowerCase(), department || null]
      );
    }

    res.status(201).json({
      success: true,
      message: 'User registered successfully.',
      user: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/auth/me
 */
const getMe = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT u.id, u.name, u.email, u.role_id, u.agent_id, u.department, u.phone, u.last_login, u.created_at, r.name as role
       FROM users u JOIN roles r ON u.role_id = r.id
       WHERE u.id = $1`,
      [req.user.id]
    );

    res.json({ success: true, user: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/auth/profile
 */
const updateProfile = async (req, res, next) => {
  try {
    const { name, department, phone } = req.body;
    const result = await query(
      `UPDATE users SET name = COALESCE($1, name), department = COALESCE($2, department), phone = COALESCE($3, phone), updated_at = NOW()
       WHERE id = $4 RETURNING id, name, email, role_id, agent_id, department, phone`,
      [name, department, phone, req.user.id]
    );
    res.json({ success: true, message: 'Profile updated.', user: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/auth/change-password
 */
const changePassword = async (req, res, next) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) {
      return res.status(400).json({ success: false, message: 'Current and new password required.' });
    }

    const result = await query('SELECT password FROM users WHERE id = $1', [req.user.id]);
    const valid = await bcrypt.compare(current_password, result.rows[0].password);
    if (!valid) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
    }

    const hashed = await bcrypt.hash(new_password, 10);
    await query('UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2', [hashed, req.user.id]);

    res.json({ success: true, message: 'Password changed successfully.' });
  } catch (error) {
    next(error);
  }
};

module.exports = { login, register, getMe, updateProfile, changePassword };
