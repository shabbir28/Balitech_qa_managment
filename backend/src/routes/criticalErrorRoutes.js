const express = require('express');
const router = express.Router();
const { getCriticalErrors, createCriticalError, updateCriticalError, deleteCriticalError } = require('../controllers/criticalErrorController');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/', authenticate, getCriticalErrors);
router.post('/', authenticate, authorize('Manager'), createCriticalError);
router.put('/:id', authenticate, authorize('Manager'), updateCriticalError);
router.delete('/:id', authenticate, authorize('Manager'), deleteCriticalError);

module.exports = router;
