const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const { uploadCalls, getCalls, getDialerSalesLeads, getCallById, deleteCall, getUploadBatches, updateCallRecording } = require('../controllers/callController');
const { authenticate, authorize } = require('../middleware/auth');

router.post('/upload', authenticate, authorize('Super Admin', 'QA Admin', 'Manager'), upload.single('file'), uploadCalls);
router.get('/dialer-sales-leads', authenticate, authorize('Super Admin', 'QA Admin', 'Manager'), getDialerSalesLeads);
router.get('/', authenticate, getCalls);
router.get('/batches', authenticate, authorize('Super Admin', 'QA Admin', 'Manager'), getUploadBatches);
router.get('/:id', authenticate, getCallById);
router.delete('/:id', authenticate, authorize('Super Admin', 'QA Admin', 'Manager'), deleteCall);
router.put('/:id/recording', authenticate, updateCallRecording);

module.exports = router;
