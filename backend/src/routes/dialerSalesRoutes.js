const express = require('express');
const router = express.Router();
const dialerSalesController = require('../controllers/dialerSalesController');
const { authenticate, checkDialerAccess } = require('../middleware/auth');

router.get('/', authenticate, checkDialerAccess, dialerSalesController.getSales);
router.get('/history', authenticate, checkDialerAccess, dialerSalesController.getHistorySales);
router.post('/sync', authenticate, checkDialerAccess, dialerSalesController.syncStatuses);
router.post('/compare', authenticate, checkDialerAccess, dialerSalesController.compareSales);
router.post('/override', authenticate, checkDialerAccess, dialerSalesController.setQaOverride);
router.post('/qa-status', authenticate, checkDialerAccess, dialerSalesController.setQaStatus);
router.post('/overrides-by-leads', authenticate, checkDialerAccess, dialerSalesController.getOverridesForLeads);
router.post('/backfill', authenticate, checkDialerAccess, dialerSalesController.backfillSales);
router.post('/assign', authenticate, checkDialerAccess, dialerSalesController.assignSales);

// Compare History
router.post('/compare-history', authenticate, checkDialerAccess, dialerSalesController.saveCompareHistory);
router.get('/compare-history', authenticate, checkDialerAccess, dialerSalesController.getCompareHistory);
router.post('/compare-history/:id/preview-recheck', authenticate, checkDialerAccess, dialerSalesController.previewRecheckCompareHistory);
router.post('/compare-history/:id/recheck', authenticate, checkDialerAccess, dialerSalesController.recheckCompareHistory);

// Conditional auth for test route
const conditionalTestAuth = (req, res, next) => {
  if (process.env.NODE_ENV !== 'production') {
    return next();
  }
  // Apply auth in production
  authenticate(req, res, (err) => {
    if (err) return next(err);
    checkDialerAccess(req, res, next);
  });
};

// HRMS Sync Test — sends one test record to HRMS, verifies integration
router.post('/sync-hrms-test', conditionalTestAuth, dialerSalesController.syncHrmsTest);

module.exports = router;
