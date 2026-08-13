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

module.exports = router;
