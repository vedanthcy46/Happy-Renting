'use strict';

const router = require('express').Router();
const {
  getProperties, createProperty, updateProperty, deleteProperty, propertyValidation,
} = require('../controllers/propertyController');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');

router.use(authenticate);

router.get ('/', getProperties);
router.post('/', authorize('superadmin', 'owner'), propertyValidation, validate, createProperty);
router.patch('/:id', authorize('superadmin', 'owner'), propertyValidation, validate, updateProperty);
router.delete('/:id', authorize('superadmin', 'owner'), deleteProperty);

module.exports = router;
