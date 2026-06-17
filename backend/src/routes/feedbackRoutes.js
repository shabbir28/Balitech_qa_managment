const express = require('express');
const router = express.Router();
const {
  getAllFeedback, getMyFeedback, getFeedbackById,
  acknowledgeFeedback, addCoachingComment, updateImprovementSuggestions, closeFeedback,
} = require('../controllers/feedbackController');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/', authenticate, authorize('Manager'), getAllFeedback);
router.get('/my-feedback', authenticate, authorize('User'), getMyFeedback);
router.get('/:id', authenticate, getFeedbackById);
router.put('/:id/acknowledge', authenticate, authorize('User'), acknowledgeFeedback);
router.post('/:id/coaching-comment', authenticate, authorize('Manager'), addCoachingComment);
router.put('/:id/improvement-suggestions', authenticate, authorize('Manager'), updateImprovementSuggestions);
router.put('/:id/close', authenticate, authorize('Manager'), closeFeedback);

module.exports = router;
