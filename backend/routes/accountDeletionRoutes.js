'use strict';

const express = require('express');
const router = express.Router();
const controller = require('../controllers/accountDeletionController');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');

router.use(authenticate);

router.post('/request', controller.validateDeletionRequest, validate, controller.requestTenantDeletion);
router.get('/my-status', controller.getMyDeletionStatus);
router.post('/cancel', controller.cancelMyDeletion);

router.get('/owner', authorize('owner', 'superadmin'), controller.ownerGetRequests);
router.post('/owner/:id/approve', authorize('owner', 'superadmin'), controller.ownerApproveDeletion);
router.post('/owner/:id/reject', authorize('owner', 'superadmin'), controller.ownerRejectDeletion);

router.get('/admin', authorize('superadmin'), controller.adminGetAllRequests);
router.post('/admin/:id/approve', authorize('superadmin'), controller.adminApproveDeletion);
router.post('/admin/:id/reject', authorize('superadmin'), controller.adminRejectDeletion);
router.post('/admin/:id/force-delete', authorize('superadmin'), controller.adminForceDelete);

module.exports = router;
