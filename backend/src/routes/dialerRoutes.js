const express = require('express');
const router = express.Router();
const dialerController = require('../controllers/dialerController');
const { authenticate } = require('../middleware/auth');

// Route to search for a lead by phone number
router.get('/search', authenticate, dialerController.searchLead);

// Route to get recordings for a specific lead
router.get('/recordings/:leadId', authenticate, dialerController.getRecordings);

// Route to get lead info
router.get('/lead/:leadId', authenticate, dialerController.getLeadInfo);

module.exports = router;
