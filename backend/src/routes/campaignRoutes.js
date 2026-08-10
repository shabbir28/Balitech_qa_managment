const express = require('express');
const router = express.Router();
const { getCampaigns, createCampaign } = require('../controllers/userController');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/', authenticate, getCampaigns);
router.post('/', authenticate, authorize('Super Admin', 'QA Admin'), createCampaign);

module.exports = router;
