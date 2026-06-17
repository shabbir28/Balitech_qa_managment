const express = require('express');
const router = express.Router();
const {
  getTeams, createTeam, deleteTeam,
  getTeamMembers, addTeamMember, removeTeamMember, getAvailableUsers,
  getAssignments, createAssignments, acceptAssignment, completeAssignment, deleteAssignment,
  createManagedUser,
} = require('../controllers/teamController');
const { authenticate, authorize } = require('../middleware/auth');

const managerOrAdmin = authorize('Manager');

// Teams
router.get('/', authenticate, managerOrAdmin, getTeams);
router.post('/', authenticate, managerOrAdmin, createTeam);
router.delete('/:id', authenticate, managerOrAdmin, deleteTeam);

// Team Members
router.get('/members/available', authenticate, managerOrAdmin, getAvailableUsers);
router.get('/:id/members', authenticate, managerOrAdmin, getTeamMembers);
router.post('/:id/members', authenticate, managerOrAdmin, addTeamMember);
router.delete('/:id/members/:userId', authenticate, managerOrAdmin, removeTeamMember);

// Create user (manager creates QA accounts)
router.post('/create-user', authenticate, managerOrAdmin, createManagedUser);

module.exports = router;
