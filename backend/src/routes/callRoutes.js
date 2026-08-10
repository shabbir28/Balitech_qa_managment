const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const { uploadCalls, getCalls, getCallById, deleteCall, getUploadBatches, updateCallRecording } = require('../controllers/callController');
const { authenticate, authorize } = require('../middleware/auth');

router.post('/upload', authenticate, authorize('Super Admin', 'QA Admin'), upload.single('file'), uploadCalls);
router.get('/', authenticate, getCalls);
router.get('/batches', authenticate, authorize('Super Admin', 'QA Admin'), getUploadBatches);
router.get('/:id', authenticate, getCallById);
router.delete('/:id', authenticate, authorize('Super Admin', 'QA Admin'), deleteCall);
router.put('/:id/recording', authenticate, updateCallRecording);

module.exports = router;
