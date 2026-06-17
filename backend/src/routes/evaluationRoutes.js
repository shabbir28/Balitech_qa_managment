const express = require('express');
const router = express.Router();
const { createEvaluation, getEvaluations, getEvaluationById, updateEvaluation, deleteEvaluation } = require('../controllers/evaluationController');
const { authenticate, authorize } = require('../middleware/auth');

router.post('/', authenticate, authorize('Manager', 'User'), createEvaluation);
router.get('/', authenticate, getEvaluations);
router.get('/:id', authenticate, getEvaluationById);
router.put('/:id', authenticate, authorize('Manager', 'User'), updateEvaluation);
router.delete('/:id', authenticate, authorize('Manager'), deleteEvaluation);

module.exports = router;
