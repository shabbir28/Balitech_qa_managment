const isDev = (process.env.NODE_ENV || 'production') === 'development';

/**
 * Global error handling middleware
 * NOTE: err.detail and internal DB info are hidden in production to prevent
 * information leakage about table/column structure.
 */
const errorHandler = (err, req, res, next) => {
  // Always log full error server-side
  console.error('Error:', err.message || err);
  if (isDev) console.error(err.stack);

  // PostgreSQL unique violation (23505)
  if (err.code === '23505') {
    return res.status(409).json({
      success: false,
      message: 'Duplicate entry. Record already exists.',
      // Only expose detail in development — never in production
      ...(isDev && { detail: err.detail }),
    });
  }

  // PostgreSQL foreign key violation (23503)
  if (err.code === '23503') {
    return res.status(400).json({
      success: false,
      message: 'Referenced record does not exist.',
    });
  }

  // PostgreSQL not null violation (23502)
  if (err.code === '23502') {
    return res.status(400).json({
      success: false,
      message: isDev ? `Required field missing: ${err.column}` : 'A required field is missing.',
    });
  }

  // PostgreSQL check constraint violation (23514)
  if (err.code === '23514') {
    return res.status(400).json({
      success: false,
      message: 'Data validation failed. Please check your input values.',
    });
  }

  // Multer: file too large
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      message: 'File too large. Maximum size is 250MB.',
    });
  }

  // Multer: unexpected field
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({
      success: false,
      message: 'Unexpected file field.',
    });
  }

  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || 'Internal server error';

  res.status(statusCode).json({
    success: false,
    message,
    // Only expose stack trace in development
    ...(isDev && { stack: err.stack }),
  });
};

/**
 * 404 Not Found handler
 */
const notFound = (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
};

module.exports = { errorHandler, notFound };
