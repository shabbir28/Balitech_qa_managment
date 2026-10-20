const express = require('express');
const router = express.Router();
const { getDashboardStats, getDashboardCharts } = require('../controllers/dashboardController');
const { authenticate } = require('../middleware/auth');
const { getDurationSales } = require('../controllers/durationDashboardController');

router.get('/duration-sales', authenticate, getDurationSales);
router.get('/stats', authenticate, getDashboardStats);
router.get('/charts', authenticate, getDashboardCharts);

module.exports = router;
