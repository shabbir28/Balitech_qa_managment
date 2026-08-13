const express = require('express');
const router = express.Router();
const dialerController = require('../controllers/dialerController');
const { authenticate, checkDialerAccess } = require('../middleware/auth');

// Route to search for a lead by phone number
router.get('/search', authenticate, checkDialerAccess, dialerController.searchLead);

// Route to get recordings for a specific lead
router.get('/recordings/:leadId', authenticate, checkDialerAccess, dialerController.getRecordings);

// Route to get lead info
router.get('/lead/:leadId', authenticate, checkDialerAccess, dialerController.getLeadInfo);

// Route to import lead into local DB for evaluation
router.post('/import-lead', authenticate, checkDialerAccess, dialerController.importLeadForEval);

module.exports = router;
