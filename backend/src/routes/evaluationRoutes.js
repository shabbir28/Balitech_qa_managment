const express = require('express');
const router = express.Router();
const {
  createEvaluation,
  getEvaluations,
  getEvaluationById,
  updateEvaluation,
  deleteEvaluation,
  patchEvaluationStatus,
  getAgentErrorReport,
  getRejectedCallsReport,
  getDailyQaReport,
  getMedicareDailyEvaluations,
  saveDailyQaSummary,
  getEvaluationDropdownOptions,
  addEvaluationDropdownOption,
  removeEvaluationDropdownOption,
  savePendingCall,
  getPendingCall,
  getMyPendingCalls,
} = require('../controllers/evaluationController');
const { authenticate, authorize } = require('../middleware/auth');

router.post('/', authenticate, authorize('Super Admin', 'QA Admin', 'QA Agent', 'Manager'), createEvaluation);
router.get('/', authenticate, getEvaluations);
router.get('/reports/agent-errors', authenticate, authorize('Super Admin', 'QA Admin', 'QA Agent', 'Manager'), getAgentErrorReport);
router.get('/reports/rejected', authenticate, authorize('Super Admin', 'QA Admin', 'QA Agent', 'Manager'), getRejectedCallsReport);
router.get('/reports/daily', authenticate, authorize('Super Admin', 'QA Admin', 'QA Agent', 'Manager'), getDailyQaReport);
router.get('/reports/medicare-daily', authenticate, authorize('Super Admin', 'QA Admin', 'QA Agent', 'Manager'), getMedicareDailyEvaluations);
router.put('/reports/daily/summary', authenticate, authorize('Super Admin', 'QA Admin', 'QA Agent', 'Manager'), saveDailyQaSummary);
router.get('/options/dropdowns', authenticate, getEvaluationDropdownOptions);
router.post('/options/dropdowns', authenticate, authorize('Super Admin', 'QA Admin', 'QA Agent', 'Manager'), addEvaluationDropdownOption);
router.delete('/options/dropdowns', authenticate, authorize('Super Admin', 'QA Admin', 'Manager'), removeEvaluationDropdownOption);

// Pending call drafts — must be registered BEFORE /:id to avoid conflicts
router.get('/pending', authenticate, authorize('Super Admin', 'QA Admin', 'QA Agent', 'Manager'), getMyPendingCalls);
router.post('/pending', authenticate, authorize('Super Admin', 'QA Admin', 'QA Agent', 'Manager'), savePendingCall);
router.get('/pending/:callId', authenticate, authorize('Super Admin', 'QA Admin', 'QA Agent', 'Manager'), getPendingCall);

router.get('/:id', authenticate, getEvaluationById);
router.put('/:id', authenticate, authorize('Super Admin', 'QA Admin', 'QA Agent', 'Manager'), updateEvaluation);
router.patch('/:id/status', authenticate, authorize('Super Admin', 'QA Admin', 'QA Agent', 'Manager'), patchEvaluationStatus);
router.delete('/:id', authenticate, authorize('Super Admin', 'QA Admin', 'Manager'), deleteEvaluation);

module.exports = router;
