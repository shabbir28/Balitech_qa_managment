const express = require('express');
const router = express.Router();
const { getCriticalErrors, createCriticalError, updateCriticalError, deleteCriticalError } = require('../controllers/criticalErrorController');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/', authenticate, getCriticalErrors);
router.post('/', authenticate, authorize('Super Admin', 'QA Admin'), createCriticalError);
router.put('/:id', authenticate, authorize('Super Admin', 'QA Admin'), updateCriticalError);
router.delete('/:id', authenticate, authorize('Super Admin', 'QA Admin'), deleteCriticalError);

module.exports = router;
