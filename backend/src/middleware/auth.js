const jwt = require('jsonwebtoken');
const { query } = require('../config/database');

/**
 * Authentication middleware - verifies JWT token
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Fetch fresh user data from DB
    const result = await query(
      `SELECT u.id, u.name, u.email, u.role_id, u.agent_id, u.is_active, u.campaign_id, r.name as role, c.name as campaign_name 
       FROM users u 
       JOIN roles r ON u.role_id = r.id 
       LEFT JOIN campaigns c ON u.campaign_id = c.id
       WHERE u.id = $1 AND u.deleted_at IS NULL`,
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid token. User not found.' });
    }

    const user = result.rows[0];
    if (!user.is_active) {
      return res.status(401).json({ success: false, message: 'Account is deactivated.' });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token expired. Please login again.' });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ success: false, message: 'Invalid token.' });
    }
    next(error);
  }
};

/**
 * Role-based authorization middleware
 * @param {...string} roles - Allowed roles
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authenticated.' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role: ${roles.join(' or ')}. Your role: ${req.user.role}`,
      });
    }
    next();
  };
};

/**
 * Middleware to restrict dialer access based on QA Agent's assigned campaign
 */
const checkDialerAccess = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Not authenticated.' });
  }

  // Administrators (Super Admin, QA Admin) are not restricted
  if (req.user.role !== 'QA Agent') {
    return next();
  }

  // Find dialer type from query, body, or params
  let dialer = req.query.dialer || req.body.dialer || req.params.dialer;

  if (!dialer) {
    return next();
  }

  dialer = dialer.toLowerCase();
  const userCampaign = (req.user.campaign_name || '').toLowerCase();

  // If QA Agent has no campaign assigned, deny access
  if (!req.user.campaign_id || !userCampaign) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. You have no campaign assigned. Contact your administrator.'
    });
  }

  // Validate campaign mapping
  let hasAccess = false;
  if (dialer === 'medicare' && userCampaign.includes('medicare')) {
    hasAccess = true;
  } else if (dialer === 'pharmacy' && userCampaign.includes('pharmacy')) {
    hasAccess = true;
  }

  if (!hasAccess) {
    return res.status(403).json({
      success: false,
      message: `Access denied. You are assigned to the "${req.user.campaign_name}" campaign and cannot access the "${dialer}" dialer.`
    });
  }

  next();
};

module.exports = { authenticate, authorize, checkDialerAccess };
