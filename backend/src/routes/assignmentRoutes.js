const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');

const {
  getAssignments, createAssignments, acceptAssignment, rejectAssignment, acceptAllAssignments, completeAssignment, deleteAssignment, uploadAssignments
} = require('../controllers/teamController');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/', authenticate, getAssignments);
router.post('/', authenticate, authorize('Super Admin', 'QA Admin'), createAssignments);
router.post('/upload', authenticate, authorize('Super Admin', 'QA Admin'), upload.single('file'), uploadAssignments);
router.patch('/accept-all', authenticate, acceptAllAssignments);
router.patch('/:id/accept', authenticate, acceptAssignment);
router.patch('/:id/reject', authenticate, rejectAssignment);
router.patch('/:id/complete', authenticate, completeAssignment);
router.delete('/:id', authenticate, authorize('Super Admin', 'QA Admin'), deleteAssignment);

module.exports = router;
