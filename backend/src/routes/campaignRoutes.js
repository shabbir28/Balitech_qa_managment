const express = require('express');
const router = express.Router();
const { getCampaigns, createCampaign } = require('../controllers/userController');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/', authenticate, getCampaigns);
router.post('/', authenticate, authorize('Manager'), createCampaign);

module.exports = router;
