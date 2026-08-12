const express = require('express');
const router = express.Router();
const dialerSalesController = require('../controllers/dialerSalesController');
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, dialerSalesController.getSales);
router.post('/sync', authenticate, dialerSalesController.syncStatuses);

module.exports = router;
