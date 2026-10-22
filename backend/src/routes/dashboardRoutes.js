const express = require('express');
const router = express.Router();
const { getDashboardStats, getDashboardCharts } = require('../controllers/dashboardController');
const { authenticate, authorize } = require('../middleware/auth');
const { getDurationSales } = require('../controllers/durationDashboardController');

router.get('/duration-sales', authenticate, authorize('Super Admin'), getDurationSales);
router.get('/stats', authenticate, getDashboardStats);
router.get('/charts', authenticate, getDashboardCharts);

module.exports = router;
