const express = require('express');
const router = express.Router();
const { getRoles, getCampaigns, createCampaign } = require('../controllers/userController');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/', authenticate, getRoles);

module.exports = router;
