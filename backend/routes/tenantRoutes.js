'use strict';

const router = require('express').Router();
const {
  getTenants, getTenant, addTenant, updateTenant, moveOutTenant, getMyTenancy,
  addCoOccupants, addTenantValidation, moveOutValidation,
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
router.patch('/:id/moveout',    authorize('superadmin', 'owner'),  moveOutValidation, validate, moveOutTenant);
router.post ('/:id/co-occupants',authorize('superadmin', 'owner', 'tenant'),  addCoOccupants);

module.exports = router;
