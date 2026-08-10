const express = require('express');
const router = express.Router();
const { createEvaluation, getEvaluations, getEvaluationById, updateEvaluation, deleteEvaluation } = require('../controllers/evaluationController');
const { authenticate, authorize } = require('../middleware/auth');

router.post('/', authenticate, authorize('Super Admin', 'QA Admin', 'QA Agent'), createEvaluation);
router.get('/', authenticate, getEvaluations);
router.get('/:id', authenticate, getEvaluationById);
router.put('/:id', authenticate, authorize('Super Admin', 'QA Admin', 'QA Agent'), updateEvaluation);
router.delete('/:id', authenticate, authorize('Super Admin', 'QA Admin'), deleteEvaluation);

module.exports = router;
