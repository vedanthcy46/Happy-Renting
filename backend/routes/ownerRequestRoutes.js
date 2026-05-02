'use strict';

const express = require('express');
const router  = express.Router();
const controller = require('../controllers/ownerRequestController');
const { authenticate, authorize } = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

// Rate limiter for submissions (prevent spam)
const submissionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Limit each IP to 5 requests per hour
  message: { success: false, message: 'Too many requests. Please try again after an hour.' }
});

// Public: Submit request
router.post('/', submissionLimiter, controller.validateRequest, controller.submitRequest);

// Admin Only: Get and update requests
router.use(authenticate);
router.use(authorize('superadmin'));

router.get('/', controller.getRequests);
router.patch('/:id/status', controller.updateRequestStatus);

module.exports = router;
