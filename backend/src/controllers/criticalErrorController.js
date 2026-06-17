const { query } = require('../config/database');

/**
 * GET /api/critical-errors
 */
const getCriticalErrors = async (req, res, next) => {
  try {
    const result = await query(
      'SELECT * FROM critical_errors WHERE is_active = TRUE ORDER BY severity DESC, error_type ASC'
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/critical-errors
 */
const createCriticalError = async (req, res, next) => {
  try {
    const { error_type, description, severity } = req.body;
    if (!error_type) {
      return res.status(400).json({ success: false, message: 'error_type is required.' });
    }
    const result = await query(
      'INSERT INTO critical_errors (error_type, description, severity) VALUES ($1, $2, $3) RETURNING *',
      [error_type, description || '', severity || 'High']
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/critical-errors/:id
 */
const updateCriticalError = async (req, res, next) => {
  try {
    const { error_type, description, severity, is_active } = req.body;
    const result = await query(
      `UPDATE critical_errors SET
        error_type = COALESCE($1, error_type),
        description = COALESCE($2, description),
        severity = COALESCE($3, severity),
        is_active = COALESCE($4, is_active),
        updated_at = NOW()
       WHERE id = $5 RETURNING *`,
      [error_type, description, severity, is_active, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Critical error type not found.' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/critical-errors/:id
 */
const deleteCriticalError = async (req, res, next) => {
  try {
    const result = await query(
      'UPDATE critical_errors SET is_active = FALSE, updated_at = NOW() WHERE id = $1 RETURNING id',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Critical error type not found.' });
    }
    res.json({ success: true, message: 'Critical error type deactivated.' });
  } catch (error) {
    next(error);
  }
};

module.exports = { getCriticalErrors, createCriticalError, updateCriticalError, deleteCriticalError };
