'use strict';

const router = require('express').Router();
const {
  getTenants, getTenant, addTenant, updateTenant, moveOutTenant, reverseMoveOut, getMyTenancy,
  addCoOccupants, updateCoOccupant, deleteCoOccupant, addTenantValidation, moveOutValidation,
  markRefundSettled, submitMoveOutRequest, getMoveOutRequest
} = require('../controllers/tenantController');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');

router.use(authenticate);

// Tenant self-view — must be before /:id to avoid conflict
router.get('/my', authorize('tenant'), getMyTenancy);

router.get ('/',                authorize('superadmin', 'owner'),  getTenants);
router.get ('/:id',             authorize('superadmin', 'owner', 'tenant'), getTenant);
router.post('/',                authorize('superadmin', 'owner'),  addTenantValidation, validate, addTenant);
router.patch('/:id',            authorize('superadmin', 'owner'),  updateTenant);
router.patch('/:id/moveout',          authorize('superadmin', 'owner'),  moveOutValidation, validate, moveOutTenant);
router.patch('/:id/reverse-moveout',  authorize('superadmin', 'owner'),  reverseMoveOut);
router.post ('/:id/co-occupants',authorize('superadmin', 'owner', 'tenant'),  addCoOccupants);
router.patch('/:id/co-occupants/:coId', authorize('superadmin', 'owner', 'tenant'), updateCoOccupant);
router.delete('/:id/co-occupants/:coId', authorize('superadmin', 'owner', 'tenant'), deleteCoOccupant);

router.post ('/:id/moveout-request', authorize('superadmin', 'tenant'), submitMoveOutRequest);
router.get ('/:id/moveout-request', authorize('superadmin', 'owner', 'tenant'), getMoveOutRequest);

router.patch('/:id/mark-refund-settled', authorize('superadmin', 'owner'), markRefundSettled);

module.exports = router;
