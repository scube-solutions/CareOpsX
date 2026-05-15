const router = require('express').Router();
const { verifyToken, requireRole } = require('../middlewares/auth');
const ctrl = require('../controllers/superAdminController');

const superAdminOnly = [verifyToken, requireRole([9])];

router.get('/next-org-code', ...superAdminOnly, ctrl.getNextOrgCode);
router.get('/organizations', ...superAdminOnly, ctrl.getOrganizations);
router.get('/organizations/:id', ...superAdminOnly, ctrl.getOrganizationDetail);
router.post('/organizations', ...superAdminOnly, ctrl.createOrganization);
router.put('/organizations/:id', ...superAdminOnly, ctrl.updateOrganization);
router.patch('/organizations/:id/status', ...superAdminOnly, ctrl.updateOrganizationStatus);
router.post('/organizations/:id/impersonate', ...superAdminOnly, ctrl.impersonateOrganization);
router.post('/organizations/:id/reset-user-password', ...superAdminOnly, ctrl.resetUserPassword);
router.delete('/organizations/:id', ...superAdminOnly, ctrl.deleteOrganization);
router.delete('/organizations/:id/users/:userId', ...superAdminOnly, ctrl.deleteOrgUser);

module.exports = router;
