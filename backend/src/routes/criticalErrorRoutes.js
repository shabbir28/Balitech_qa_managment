const express = require('express');
const router = express.Router();
const { getCriticalErrors, createCriticalError, updateCriticalError, deleteCriticalError } = require('../controllers/criticalErrorController');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/', authenticate, getCriticalErrors);
router.post('/', authenticate, authorize('Super Admin', 'QA Admin', 'Manager'), createCriticalError);
router.put('/:id', authenticate, authorize('Super Admin', 'QA Admin', 'Manager'), updateCriticalError);
router.delete('/:id', authenticate, authorize('Super Admin', 'QA Admin', 'Manager'), deleteCriticalError);

module.exports = router;
