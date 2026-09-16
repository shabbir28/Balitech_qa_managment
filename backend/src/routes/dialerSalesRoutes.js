const express = require('express');
const router = express.Router();
const dialerSalesController = require('../controllers/dialerSalesController');
const { authenticate, authorize, checkDialerAccess } = require('../middleware/auth');

// Bulk dialer pulls and lead hand-outs are leadership actions; the UI already
// disables them for QA Agents, so the API must refuse them too.
const leadershipOnly = authorize('Super Admin', 'QA Admin', 'Manager');

router.get('/', authenticate, checkDialerAccess, dialerSalesController.getSales);
router.get('/history', authenticate, checkDialerAccess, dialerSalesController.getHistorySales);
router.post('/sync', authenticate, leadershipOnly, checkDialerAccess, dialerSalesController.syncStatuses);
router.post('/compare', authenticate, checkDialerAccess, dialerSalesController.compareSales);
router.post('/override', authenticate, checkDialerAccess, dialerSalesController.setQaOverride);
router.post('/qa-status', authenticate, checkDialerAccess, dialerSalesController.setQaStatus);
router.post('/overrides-by-leads', authenticate, checkDialerAccess, dialerSalesController.getOverridesForLeads);
router.post('/backfill', authenticate, leadershipOnly, checkDialerAccess, dialerSalesController.backfillSales);
router.post('/assign', authenticate, leadershipOnly, checkDialerAccess, dialerSalesController.assignSales);

// Compare History
router.post('/compare-history', authenticate, checkDialerAccess, dialerSalesController.saveCompareHistory);
router.get('/compare-history', authenticate, checkDialerAccess, dialerSalesController.getCompareHistory);
router.post('/compare-history/:id/preview-recheck', authenticate, checkDialerAccess, dialerSalesController.previewRecheckCompareHistory);
router.post('/compare-history/:id/recheck', authenticate, checkDialerAccess, dialerSalesController.recheckCompareHistory);

// HRMS Sync Test — sends one test record to HRMS with the real shared secret,
// so it is admin-only in every environment (a dev box can be reachable too).
router.post('/sync-hrms-test', authenticate, authorize('Super Admin', 'QA Admin'), dialerSalesController.syncHrmsTest);

module.exports = router;
