require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');

const { errorHandler, notFound } = require('./src/middleware/errorHandler');

// Route imports
const authRoutes = require('./src/routes/authRoutes');
const callRoutes = require('./src/routes/callRoutes');
const evaluationRoutes = require('./src/routes/evaluationRoutes');
const dialerSalesRoutes = require('./src/routes/dialerSalesRoutes');
const criticalErrorRoutes = require('./src/routes/criticalErrorRoutes');
const feedbackRoutes = require('./src/routes/feedbackRoutes');
const dashboardRoutes = require('./src/routes/dashboardRoutes');
const userRoutes = require('./src/routes/userRoutes');
const rolesRoutes = require('./src/routes/rolesRoutes');
const campaignRoutes = require('./src/routes/campaignRoutes');
const teamRoutes = require('./src/routes/teamRoutes');
const assignmentRoutes = require('./src/routes/assignmentRoutes');
const dialerRoutes = require('./src/routes/dialerRoutes');
const initSalesSyncCron = require('./src/cron/salesSync');
const initAssignmentExpirationCron = require('./src/cron/assignmentExpirationCron');

if (!process.env.JWT_SECRET) {
  console.error('❌ JWT_SECRET is not set. Configure it in your .env file before starting the server.');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'production';

// ── Trust Proxy (required for rate-limit behind Nginx/load balancer) ──
app.set('trust proxy', 1);

// ── Security Middleware ──────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// ── Auth rate limiting (stricter — MUST be registered BEFORE general limiter) ──
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,                   // 20 login attempts per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts. Please try again later.' },
});
app.use('/api/auth/login', authLimiter);

// ── General API rate limiting ─────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' },
});
app.use('/api', limiter);

// ── CORS ─────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ── Body Parsing ──────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Chrome DevTools / Cursor probes hit /json/version on whatever is listening.
const isProbeRequest = (req) =>
  req.path === '/json/version' ||
  req.path === '/json/list' ||
  req.path === '/json' ||
  req.path === '/favicon.ico';

// ── Logging ───────────────────────────────────────────────────────────
const morganSkip = (req) => isProbeRequest(req);
if (NODE_ENV === 'development') {
  app.use(morgan('dev', { skip: morganSkip }));
} else {
  // Use combined format in production for proper access log monitoring
  app.use(morgan('combined', { skip: morganSkip }));
}

// ── Static Uploads ────────────────────────────────────────────────────
// Batch files hold customer data, so they are never served anonymously —
// a leaked or guessed filename must not be enough to download them.
const { authenticate, authorize } = require('./src/middleware/auth');
app.use(
  '/uploads',
  authenticate,
  authorize('Super Admin', 'QA Admin', 'Manager'),
  express.static(path.join(__dirname, 'uploads'))
);

// ── Health Check ──────────────────────────────────────────────────────
const healthPayload = () => ({
  success: true,
  message: 'BPO QA System API is running.',
  health: '/api/health',
  timestamp: new Date().toISOString(),
});

app.get('/', (req, res) => {
  res.json(healthPayload());
});

app.get('/api/health', (req, res) => {
  res.json(healthPayload());
});

// Quiet Chrome DevTools Protocol probes (not API routes)
app.get(['/json', '/json/version', '/json/list'], (req, res) => {
  res.status(204).end();
});

// ── API Routes ────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/calls', callRoutes);
app.use('/api/evaluations', evaluationRoutes);
app.use('/api/dialer-sales', dialerSalesRoutes);
app.use('/api/critical-errors', criticalErrorRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/users', userRoutes);
app.use('/api/roles', rolesRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/dialer', dialerRoutes);

// ── Error Handling ────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ── Initialize Cron Jobs ──────────────────────────────────────────────
initSalesSyncCron();
initAssignmentExpirationCron();

// ── Start Server ──────────────────────────────────────────────────────
const server = app.listen(PORT, () => {
  console.log(`\n🚀 BPO QA Management System API`);
  console.log(`   Server running on http://localhost:${PORT}`);
  console.log(`   Environment: ${NODE_ENV}`);
  console.log(`   Database: ${process.env.DB_NAME}@${process.env.DB_HOST}:${process.env.DB_PORT}\n`);
});

// ── Process safety ────────────────────────────────────────────────────
// A rejected promise nobody awaited (cron, fire-and-forget sync) should be
// logged, not silently dropped or allowed to crash the process without a trace.
process.on('unhandledRejection', (reason) => {
  console.error('❌ Unhandled promise rejection:', reason instanceof Error ? reason.stack : reason);
});
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught exception, shutting down:', err.stack || err);
  shutdown('uncaughtException', 1);
});

// Drain in-flight requests and close DB connections on PM2/systemd restarts.
let shuttingDown = false;
function shutdown(signal, exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n${signal} received — closing server...`);
  const forceExit = setTimeout(() => {
    console.error('Forced exit: connections did not close in time.');
    process.exit(exitCode || 1);
  }, 10000).unref();

  server.close(async () => {
    try {
      const { pool } = require('./src/config/database');
      await pool.end();
    } catch (e) {
      console.error('Error closing database pool:', e.message);
    }
    clearTimeout(forceExit);
    process.exit(exitCode);
  });
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = app;

