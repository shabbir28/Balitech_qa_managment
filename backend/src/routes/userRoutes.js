const express = require('express');
const router = express.Router();
const { getUsers, updateUser, deleteUser, resetPassword, getRoles, getManagedUsersStats } = require('../controllers/userController');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/managed-stats', authenticate, authorize('Manager'), getManagedUsersStats);
router.get('/', authenticate, authorize('Manager'), getUsers);
router.put('/:id', authenticate, authorize('Manager'), updateUser);
router.delete('/:id', authenticate, authorize('Manager'), deleteUser);
router.put('/:id/reset-password', authenticate, authorize('Manager'), resetPassword);

module.exports = router;
