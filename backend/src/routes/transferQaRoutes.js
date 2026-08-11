const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const {
  getPendingTransfers,
  getReviewedTransfers,
  getRejectedTransfers,
  getTransferStatus,
  updateTransferStatus,
  assignTransfer,
  assignBatchTransfers
} = require('../controllers/transferQaController');

// All transfer QA routes are protected
router.use(authenticate);

// Allow access to Super Admin, QA Admin, and QA Agent
router.use(authorize('Super Admin', 'QA Admin', 'QA Agent'));

// GET /api/transfer-qa/pending
router.get('/pending', getPendingTransfers);

// GET /api/transfer-qa/reviewed
router.get('/reviewed', getReviewedTransfers);

// GET /api/transfer-qa/rejected
router.get('/rejected', getRejectedTransfers);

// POST /api/transfer-qa/update-status
router.post('/update-status', updateTransferStatus);

// GET /api/transfer-qa/:transfer_id
router.get('/:transfer_id', getTransferStatus);

// POST /api/transfer-qa/assign (Super Admin / QA Admin only)
router.post('/assign', authorize('Super Admin', 'QA Admin'), assignTransfer);

// POST /api/transfer-qa/assign-batch (Super Admin / QA Admin only)
router.post('/assign-batch', authorize('Super Admin', 'QA Admin'), assignBatchTransfers);

module.exports = router;
