const express = require('express');
const router = express.Router();
const { getUsers, updateUser, deleteUser, resetPassword, getRoles, getManagedUsersStats } = require('../controllers/userController');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/managed-stats', authenticate, authorize('Super Admin', 'QA Admin', 'QA Agent', 'Manager'), getManagedUsersStats);
router.get('/', authenticate, authorize('Super Admin', 'QA Admin', 'Manager'), getUsers);
router.put('/:id', authenticate, authorize('Super Admin'), updateUser);
router.delete('/:id', authenticate, authorize('Super Admin'), deleteUser);
router.put('/:id/reset-password', authenticate, authorize('Super Admin'), resetPassword);

module.exports = router;
