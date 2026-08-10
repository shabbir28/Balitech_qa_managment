const express = require('express');
const router = express.Router();
const {
  getAllFeedback, getMyFeedback, getFeedbackById,
  acknowledgeFeedback, addCoachingComment, updateImprovementSuggestions, closeFeedback,
} = require('../controllers/feedbackController');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/', authenticate, authorize('Super Admin', 'QA Admin'), getAllFeedback);
router.get('/my-feedback', authenticate, authorize('QA Agent'), getMyFeedback);
router.get('/:id', authenticate, getFeedbackById);
router.put('/:id/acknowledge', authenticate, authorize('QA Agent'), acknowledgeFeedback);
router.post('/:id/coaching-comment', authenticate, authorize('Super Admin', 'QA Admin'), addCoachingComment);
router.put('/:id/improvement-suggestions', authenticate, authorize('Super Admin', 'QA Admin'), updateImprovementSuggestions);
router.put('/:id/close', authenticate, authorize('Super Admin', 'QA Admin'), closeFeedback);

module.exports = router;
