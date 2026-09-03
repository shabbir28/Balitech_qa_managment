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

// ── Logging ───────────────────────────────────────────────────────────
if (NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  // Use combined format in production for proper access log monitoring
  app.use(morgan('combined'));
}

// ── Static Uploads ────────────────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── Health Check ──────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'BPO QA System API is running.', timestamp: new Date().toISOString() });
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

// ── Start Server ──────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 BPO QA Management System API`);
  console.log(`   Server running on http://localhost:${PORT}`);
  console.log(`   Environment: ${NODE_ENV}`);
  console.log(`   Database: ${process.env.DB_NAME}@${process.env.DB_HOST}:${process.env.DB_PORT}\n`);
});

module.exports = app;
// Triggered restart for new .env variables

