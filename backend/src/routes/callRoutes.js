const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const { uploadCalls, getCalls, getCallById, deleteCall, getUploadBatches } = require('../controllers/callController');
const { authenticate, authorize } = require('../middleware/auth');

router.post('/upload', authenticate, authorize('Manager'), upload.single('file'), uploadCalls);
router.get('/', authenticate, getCalls);
router.get('/batches', authenticate, authorize('Manager'), getUploadBatches);
router.get('/:id', authenticate, getCallById);
router.delete('/:id', authenticate, authorize('Manager'), deleteCall);

module.exports = router;
