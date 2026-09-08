const express = require('express');
const router = express.Router();
const {
  createEvaluation,
  getEvaluations,
  getEvaluationById,
  updateEvaluation,
  deleteEvaluation,
  getAgentErrorReport,
  getEvaluationDropdownOptions
} = require('../controllers/evaluationController');
const { authenticate, authorize } = require('../middleware/auth');

router.post('/', authenticate, authorize('Super Admin', 'QA Admin', 'QA Agent', 'Manager'), createEvaluation);
router.get('/', authenticate, getEvaluations);
router.get('/reports/agent-errors', authenticate, authorize('Super Admin', 'QA Admin', 'QA Agent', 'Manager'), getAgentErrorReport);
router.get('/options/dropdowns', authenticate, getEvaluationDropdownOptions);
router.get('/:id', authenticate, getEvaluationById);
router.put('/:id', authenticate, authorize('Super Admin', 'QA Admin', 'QA Agent', 'Manager'), updateEvaluation);
router.delete('/:id', authenticate, authorize('Super Admin', 'QA Admin', 'Manager'), deleteEvaluation);

module.exports = router;
